// intent: Bridge Paperclip's activity_log writes into the synthetic event
//   names this plugin already routes (issue.completed, issue.blocked,
//   document.*, agent.error, budget.threshold, heartbeat_run.completed).
// status: done — wired via `activity.logged` event subscription
// next: if the host ever exposes a real `ctx.activity.list()` we can switch
//   to true polling (cursor-based catch-up after restart). For now we rely
//   on the live `activity.logged` stream + a state-stored "lastEventId" for
//   simple replay deduplication.
// confidence: medium
//
// IMPORTANT — design deviation from the β-prep brief:
//   The brief assumed `ctx.activity.list({ since })` exists. The actual
//   plugin SDK (`PluginActivityClient`) only exposes a write method
//   (`log(entry)`); there is no read API. Paperclip *does* however emit a
//   first-class `"activity.logged"` plugin event for every row written to
//   activity_log (see paperclip/server/dist/services/activity-log.js — the
//   server publishes both a SSE live event AND, if the action matches one
//   of the registered PLUGIN_EVENT_TYPES, a plugin-bus event).
//   Subscribing to `activity.logged` gives us the same data without polling.
//
// Cursor semantics:
//   We persist `{ lastEventId, lastSeenAt }` to ctx.state under
//   `(scopeKind: "instance", stateKey: "activity-cursor")`. The cursor is
//   used purely for *deduplication* — if the host re-delivers an event we
//   already processed (rare, but possible across worker restarts on some
//   transports) we drop it. Resetting the cursor:
//     await ctx.state.set(
//       { scopeKind: "instance", stateKey: "activity-cursor" },
//       { lastEventId: null, lastSeenAt: new Date(0).toISOString() }
//     );

import type { EventEnvelope } from "./embed-builder.js";
import { mapActivityRowToEnvelope, resolveSyntheticName, type ActivityRowLike } from "./activity-mapper.js";

/**
 * Loose ctx shape. The plugin SDK ships its types in `dist/`, which our
 * tooling treats as opaque — this minimal contract is all the poller needs.
 */
export type PollerContext = {
  events: {
    on(name: string, fn: (event: unknown) => Promise<void>): () => void;
  };
  state: {
    get(key: { scopeKind: "instance"; stateKey: string }): Promise<unknown>;
    set(key: { scopeKind: "instance"; stateKey: string }, value: unknown): Promise<void>;
  };
  logger: {
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
  };
};

const CURSOR_KEY = { scopeKind: "instance", stateKey: "activity-cursor" } as const;

type CursorState = {
  lastEventId: string | null;
  lastSeenAt: string;
};

const ZERO_CURSOR: CursorState = {
  lastEventId: null,
  lastSeenAt: new Date(0).toISOString(),
};

function isCursor(v: unknown): v is CursorState {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (c.lastEventId === null || typeof c.lastEventId === "string") && typeof c.lastSeenAt === "string";
}

/**
 * Convert a host-shaped `activity.logged` PluginEvent into the loose
 * `ActivityRowLike` the mapper accepts. The host emits:
 *   { eventId, eventType: "activity.logged", occurredAt, actorType,
 *     actorId, entityType, entityId, companyId,
 *     payload: { action, agentId, runId, ...details } }
 * We flatten that to the row-shaped object the mapper expects.
 */
function pluginEventToRow(raw: unknown): ActivityRowLike | null {
  if (!raw || typeof raw !== "object") return null;
  const ev = raw as Record<string, unknown>;
  const payload = (ev["payload"] as Record<string, unknown> | undefined) ?? {};

  // The plugin event's outer envelope is itself the activity.logged
  // notification; we look up the *action* from payload (server-side
  // activity-log.js writes payload.action) so we can map verb→synthetic.
  const action =
    (typeof payload["action"] === "string" && (payload["action"] as string)) ||
    (typeof ev["action"] === "string" && (ev["action"] as string)) ||
    null;

  if (!action) return null;

  const details = { ...payload };
  delete details.action;
  delete details.agentId;
  delete details.runId;

  return {
    id: typeof ev["eventId"] === "string" ? (ev["eventId"] as string) : undefined,
    companyId: typeof ev["companyId"] === "string" ? (ev["companyId"] as string) : null,
    actorType: typeof ev["actorType"] === "string" ? (ev["actorType"] as string) : null,
    actorId: typeof ev["actorId"] === "string" ? (ev["actorId"] as string) : null,
    action,
    entityType: typeof ev["entityType"] === "string" ? (ev["entityType"] as string) : null,
    entityId: typeof ev["entityId"] === "string" ? (ev["entityId"] as string) : null,
    agentId: typeof payload["agentId"] === "string" ? (payload["agentId"] as string) : null,
    runId: typeof payload["runId"] === "string" ? (payload["runId"] as string) : null,
    details: details as Record<string, unknown>,
    occurredAt: typeof ev["occurredAt"] === "string" ? (ev["occurredAt"] as string) : null,
  };
}

export type StartPollerOptions = {
  /** Optional override of the public Paperclip URL (deep-link base). */
  hostUrl?: string;
};

/**
 * Subscribe to `activity.logged` and forward each row that maps to a
 * synthetic event. Returns an unsubscribe function. Despite the legacy
 * "poller" name (kept to match the file/scaffold contract), this is push-
 * driven via the plugin event bus.
 */
export async function startPoller(
  ctx: PollerContext,
  emit: (envelope: EventEnvelope) => Promise<void>,
  opts: StartPollerOptions = {}
): Promise<() => void> {
  const stored = await ctx.state.get(CURSOR_KEY).catch(() => null);
  const cursor: CursorState = isCursor(stored) ? { ...stored } : { ...ZERO_CURSOR };

  ctx.logger.info("[discord-transparency] activity bridge starting", {
    lastEventId: cursor.lastEventId,
    lastSeenAt: cursor.lastSeenAt,
  });

  const unsubscribe = ctx.events.on("activity.logged", async (raw: unknown) => {
    try {
      const row = pluginEventToRow(raw);
      if (!row) return;

      // Quick gate: do we even know how to map this verb?
      const synthetic = resolveSyntheticName(row);
      if (!synthetic) return;

      // Replay dedupe: if the host re-emits the same eventId we've already
      // seen, drop it. We do NOT block strictly-monotonic timestamps here
      // because activity_log timestamps can collide on bulk writes.
      if (row.id && row.id === cursor.lastEventId) {
        ctx.logger.info("[discord-transparency] activity bridge: dropped replay", {
          eventId: row.id,
          synthetic,
        });
        return;
      }

      const envelope = mapActivityRowToEnvelope(row, { hostUrl: opts.hostUrl });
      if (!envelope) return;

      await emit(envelope);

      // Advance + persist cursor.
      cursor.lastEventId = row.id ?? cursor.lastEventId;
      cursor.lastSeenAt =
        typeof row.occurredAt === "string" ? row.occurredAt : (envelope.occurredAt ?? cursor.lastSeenAt);
      try {
        await ctx.state.set(CURSOR_KEY, cursor);
      } catch (err) {
        ctx.logger.warn("[discord-transparency] activity bridge: cursor persist failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } catch (err) {
      ctx.logger.error("[discord-transparency] activity bridge handler error", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return unsubscribe;
}

export const ACTIVITY_CURSOR_KEY = CURSOR_KEY;

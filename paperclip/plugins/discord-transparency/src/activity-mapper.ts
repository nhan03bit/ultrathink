// intent: Translate Paperclip activity_log rows into the synthetic event
//   names the router/embed-builder already understand. Synthetic events
//   are NOT emitted on the live plugin event bus — they are derived from
//   activity_log writes (verb + entity_type + details).
// status: done — covers the synthetic events declared in event-router.ts
// next: extend mapping if Paperclip adds new activity verbs we want to
//   surface (e.g. project.archived, agent.paused).
// confidence: medium
//
// Activity row shape (from @paperclipai/shared `ActivityEvent`):
//   { id, companyId, actorType: "agent"|"user"|"system",
//     actorId, action, entityType, entityId, agentId, runId, details, createdAt }
//
// NOTE: The shared `ActivityEvent.action` field is what the host calls
// "verb" elsewhere — there is a single string column, not separate
// (verb, object_type) columns. So our mapping keys off `(action, entityType)`
// where `action` already encodes the verb.
//
// Mapping (row → synthetic event):
//   action === "issue.completed"   && entityType === "issue"     → "issue.completed"
//   action === "issue.blocked"     && entityType === "issue"     → "issue.blocked"
//   action === "document.created"  && entityType === "document"  → "document.created"
//   action === "document.reviewed" && entityType === "document"  → "document.reviewed"
//   action === "document.approved" && entityType === "document"  → "document.approved"
//   action === "agent.error"       && entityType === "agent"     → "agent.error"
//   action === "budget.threshold"  && entityType === "budget"    → "budget.threshold"
//   action === "heartbeat_run.completed"                          → "heartbeat_run.completed"
//
// We also accept legacy/short verbs ("completed", "blocked", "approved",
// etc.) when the entity_type makes the meaning unambiguous, since some
// Paperclip subsystems write the verb without the prefix.

import type { EventEnvelope } from "./embed-builder.js";
import type { SyntheticEvent } from "./event-router.js";

/**
 * Minimal row shape — kept loose so the plugin SDK's exact `ActivityEvent`
 * type is not a hard dependency at compile time. We only read fields we need.
 */
export type ActivityRowLike = {
  id?: string;
  companyId?: string | null;
  actorType?: string | null;
  actorId?: string | null;
  /** The verb. May be dotted (`issue.completed`) or bare (`completed`). */
  action?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  agentId?: string | null;
  runId?: string | null;
  details?: Record<string, unknown> | null;
  /** ISO string or Date — host emits Date over RPC, callers may stringify. */
  createdAt?: string | Date | null;
  /** Optional override surfaced when the host attaches a stable timestamp. */
  occurredAt?: string | Date | null;
};

const SYNTHETIC_BY_DOTTED: Record<string, SyntheticEvent> = {
  "issue.completed": "issue.completed",
  "issue.blocked": "issue.blocked",
  "document.created": "document.created",
  "document.reviewed": "document.reviewed",
  "document.approved": "document.approved",
  "agent.error": "agent.error",
  "budget.threshold": "budget.threshold",
  "heartbeat_run.completed": "heartbeat_run.completed",
};

/**
 * Bare-verb fallback. Many subsystems write `{action: "completed", entityType: "issue"}`
 * — synthesize the dotted name when we recognize the (verb, type) pair.
 */
function dottedFromBare(verb: string, entityType: string): SyntheticEvent | null {
  const v = verb.toLowerCase();
  const t = entityType.toLowerCase();
  if (t === "issue" && v === "completed") return "issue.completed";
  if (t === "issue" && v === "blocked") return "issue.blocked";
  if (t === "document" && v === "created") return "document.created";
  if (t === "document" && v === "reviewed") return "document.reviewed";
  if (t === "document" && v === "approved") return "document.approved";
  if (t === "agent" && (v === "errored" || v === "error")) return "agent.error";
  if (t === "budget" && (v === "threshold" || v === "threshold_breached")) {
    return "budget.threshold";
  }
  if ((t === "heartbeat_run" || t === "run") && v === "completed") {
    return "heartbeat_run.completed";
  }
  return null;
}

/**
 * Resolve the synthetic event name (or null when the row is irrelevant).
 */
export function resolveSyntheticName(row: ActivityRowLike): SyntheticEvent | null {
  const action = (row.action ?? "").trim();
  const entityType = (row.entityType ?? "").trim();
  if (!action) return null;

  // Direct dotted match (e.g. "issue.completed").
  const direct = SYNTHETIC_BY_DOTTED[action];
  if (direct) return direct;

  // Bare-verb match (e.g. action="completed", entityType="issue").
  if (entityType) {
    const fallback = dottedFromBare(action, entityType);
    if (fallback) return fallback;
  }

  return null;
}

function toIsoTimestamp(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) return value;
  return undefined;
}

/**
 * Build an EventEnvelope from an activity_log row, ready for `dispatchEvent`.
 * Returns null when the row has no synthetic mapping.
 */
export function mapActivityRowToEnvelope(row: ActivityRowLike, opts: { hostUrl?: string } = {}): EventEnvelope | null {
  const name = resolveSyntheticName(row);
  if (!name) return null;

  const details = (row.details ?? {}) as Record<string, unknown>;

  // Best-effort actor reconstruction. The activity_log row only carries
  // `actorType` + `actorId` (no name/title) — the embed builder falls back
  // to "Unknown" when name is missing, which is acceptable.
  const actorName =
    (typeof details["actorName"] === "string" ? (details["actorName"] as string) : null) ??
    (typeof details["agentName"] === "string" ? (details["agentName"] as string) : null) ??
    (typeof details["userName"] === "string" ? (details["userName"] as string) : null) ??
    null;
  const actorTitle =
    typeof details["agentTitle"] === "string" || typeof details["actorTitle"] === "string"
      ? ((details["agentTitle"] ?? details["actorTitle"]) as string)
      : null;

  const actorTypeRaw = (row.actorType ?? "").toLowerCase();
  const actorType =
    actorTypeRaw === "user" ? "human" : actorTypeRaw === "agent" || actorTypeRaw === "system" ? actorTypeRaw : null;

  const occurredAt = toIsoTimestamp(row.occurredAt) ?? toIsoTimestamp(row.createdAt) ?? new Date().toISOString();

  const projectId = typeof details["projectId"] === "string" ? (details["projectId"] as string) : undefined;

  return {
    name,
    id: row.id,
    occurredAt,
    companyId: row.companyId ?? undefined,
    projectId,
    entityId: row.entityId ?? undefined,
    entityType: row.entityType ?? undefined,
    payload: details,
    actor: actorType || actorName || actorTitle ? { type: actorType, name: actorName, title: actorTitle } : null,
    triggerType: typeof details["triggerType"] === "string" ? (details["triggerType"] as string) : null,
    hostUrl: opts.hostUrl,
  };
}

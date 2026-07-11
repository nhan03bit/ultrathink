// intent: GET /humans + GET /humans/:id — surface UltraThink Neon `humans` rows
//   to the dashboard, and merge per-human Paperclip-sourced activity (issues +
//   comments authored by paperclip_user_id) with Neon memories into a single
//   `recent_activity` timeline.
//
//   Comment-as-contract counterpart to routes/activity.ts:1-6: that route is
//   PER-AGENT and explicitly does NOT cross-call Paperclip. This route is
//   PER-HUMAN and DOES cross-call Paperclip server-side, because doing the merge
//   in the UI would require two round-trips per detail page-load and complicate
//   the `paperclip_unavailable` degraded-mode flag (rev 2 design doc, C3
//   resolution). Cross-call is wrapped in a 3s Promise.race; on timeout the
//   route returns Neon-only events + meta.paperclip_unavailable=true.
// status: done
// confidence: high

import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import { getSql } from "../db.js";
import { getHumans, getHuman, getHumanByDiscordId, type HumanRow } from "../humans.js";

export const humansRouter: ExpressRouter = Router();

const PAPERCLIP_BASE = process.env.PAPERCLIP_BASE_URL ?? "http://127.0.0.1:3100";
const CROSS_CALL_BUDGET_MS = 3000;

type Lens = "memory" | "tekio" | "design-doc" | "paperclip";

interface ActivityEvent {
  id: string;
  lens: Lens;
  kind: string;
  title: string;
  detail: string | null;
  importance: number | null;
  at: string;
  meta?: Record<string, unknown>;
}

// R3 (rev 2): defense-in-depth loopback assertion. Bridge already binds 127.0.0.1
// in index.ts, but we re-assert per-route to catch future binding regressions.
// Accept-list pinned by Alex on rev 2 review.
function assertLoopback(req: Request, res: Response): boolean {
  const ip = req.ip ?? "";
  if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") return true;
  res.status(403).json({ error: "loopback only" });
  return false;
}

humansRouter.get("/", async (req: Request, res: Response) => {
  if (!assertLoopback(req, res)) return;
  try {
    const force = req.query.force === "true";
    const activeOnly = req.query.activeOnly === "true";
    let rows = await getHumans(force);
    if (activeOnly) rows = rows.filter((r) => r.is_active);
    res.json(rows);
  } catch (e: any) {
    console.error("[humans] list error", e);
    res.status(500).json({ error: e?.message ?? "internal error" });
  }
});

// INU-41 / INU-24 doc rev 2: minimal identity lookup the discord-bot uses
// to resolve `interaction.user.id` → human + paperclip principal. Registered
// BEFORE `/:id` so the literal `by-discord` segment isn't captured as `:id`.
// Returns 404 with `{error:"unmapped discord user"}` so the bot can apply
// its 1×/(user, hour) "you're not registered" reply policy.
humansRouter.get("/by-discord/:discordUserId", async (req: Request, res: Response) => {
  if (!assertLoopback(req, res)) return;
  try {
    const { discordUserId } = req.params;
    const force = req.query.force === "true";
    const human = await getHumanByDiscordId(discordUserId, force);
    if (!human) return res.status(404).json({ error: "unmapped discord user" });
    res.json({
      humanId: human.id,
      paperclipUserId: human.paperclip_user_id,
      name: human.name,
      isActive: human.is_active,
    });
  } catch (e: any) {
    console.error("[humans] by-discord lookup error", e);
    res.status(500).json({ error: e?.message ?? "internal error" });
  }
});

humansRouter.get("/:id", async (req: Request, res: Response) => {
  if (!assertLoopback(req, res)) return;
  try {
    const { id } = req.params;
    const force = req.query.force === "true";
    const since = (req.query.since as string | undefined) ?? null;
    const limit = Math.min(Number(req.query.limit ?? 100), 500);

    const human = await getHuman(id, force);
    if (!human) return res.status(404).json({ error: "human not found" });

    const memoryEvents = await fetchMemoryEvents(human.id, since, limit);

    const paperclipResult = human.paperclip_user_id
      ? await raceWithBudget(fetchPaperclipEvents(human.paperclip_user_id, since, limit), CROSS_CALL_BUDGET_MS)
      : { events: [] as ActivityEvent[], unavailable: false };

    const merged = [...memoryEvents, ...paperclipResult.events]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, limit);

    res.json({
      ...human,
      recent_activity: merged,
      meta: { paperclip_unavailable: paperclipResult.unavailable },
    });
  } catch (e: any) {
    console.error("[humans] detail error", e);
    res.status(500).json({ error: e?.message ?? "internal error" });
  }
});

async function fetchMemoryEvents(humanId: string, since: string | null, limit: number): Promise<ActivityEvent[]> {
  const sql = getSql();
  const sinceClause = since ? new Date(since).toISOString() : null;
  // The `created_by_human_id` column is referenced in the rev 2 design doc but
  // is not yet present in the memories schema (no migration adds it). Wrap the
  // query so a missing column degrades to an empty memory side rather than
  // crashing the route. Once a backfill migration lands, this just lights up.
  try {
    const rows = sinceClause
      ? ((await sql`
          SELECT id, wing, hall, category, importance, title, content, created_at
          FROM memories
          WHERE is_archived = false
            AND created_by_human_id = ${humanId}
            AND created_at >= ${sinceClause}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `) as any[])
      : ((await sql`
          SELECT id, wing, hall, category, importance, title, content, created_at
          FROM memories
          WHERE is_archived = false
            AND created_by_human_id = ${humanId}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `) as any[]);
    return rows.map((m) => ({
      id: `mem-${m.id}`,
      lens: "memory" as const,
      kind: m.category ?? "memory",
      title: m.title ?? `${m.wing ?? "?"}/${m.hall ?? "?"}`,
      detail: typeof m.content === "string" ? m.content.slice(0, 240) : null,
      importance: m.importance ?? null,
      at: m.created_at instanceof Date ? m.created_at.toISOString() : String(m.created_at),
      meta: { wing: m.wing, hall: m.hall },
    }));
  } catch (e: any) {
    console.warn("[humans] memory query degraded — column missing or query failed:", e?.message ?? e);
    return [];
  }
}

async function fetchPaperclipEvents(
  paperclipUserId: string,
  since: string | null,
  limit: number
): Promise<ActivityEvent[]> {
  // 1. companies the bridge can see (multi-company-safe; mirrors agents.ts)
  const companiesRes = await fetch(`${PAPERCLIP_BASE}/api/companies`);
  if (!companiesRes.ok) throw new Error(`paperclip /api/companies → ${companiesRes.status}`);
  const companies = (await companiesRes.json()) as Array<{ id: string }>;
  const sinceMs = since ? new Date(since).getTime() : 0;

  const events: ActivityEvent[] = [];
  for (const c of companies) {
    const issuesRes = await fetch(
      `${PAPERCLIP_BASE}/api/companies/${c.id}/issues?createdByUserId=${encodeURIComponent(paperclipUserId)}`
    );
    if (!issuesRes.ok) continue;
    const issuesRaw = (await issuesRes.json()) as Array<{
      id: string;
      identifier?: string | null;
      title?: string | null;
      createdByUserId?: string | null;
      createdAt?: string | null;
      updatedAt?: string | null;
    }>;
    // Defensive: server-side filter may not be enforced — re-filter in-process.
    const issues = issuesRaw.filter((i) => i.createdByUserId === paperclipUserId);
    for (const issue of issues) {
      const at = issue.createdAt ?? issue.updatedAt ?? null;
      if (!at) continue;
      if (sinceMs && new Date(at).getTime() < sinceMs) continue;
      events.push({
        id: `paperclip-issue-${issue.id}`,
        lens: "paperclip",
        kind: "paperclip/issue-created",
        title: `Created ${issue.identifier ?? issue.id.slice(0, 8)}: ${issue.title ?? "(untitled)"}`,
        detail: null,
        importance: null,
        at,
        meta: { issueId: issue.id, identifier: issue.identifier ?? null },
      });
      if (events.length >= limit) break;
    }
    // Per-issue comment scan: cap to the first N issues to keep cross-call
    // bounded. Each comments fetch is a separate HTTP call; the 3s race budget
    // wraps the whole walk.
    const commentScanCap = 25;
    for (const issue of issues.slice(0, commentScanCap)) {
      const cr = await fetch(`${PAPERCLIP_BASE}/api/issues/${issue.id}/comments`);
      if (!cr.ok) continue;
      const comments = (await cr.json()) as Array<{
        id: string;
        authorUserId?: string | null;
        body?: string | null;
        createdAt?: string | null;
      }>;
      for (const cm of comments) {
        if (cm.authorUserId !== paperclipUserId) continue;
        const at = cm.createdAt ?? null;
        if (!at) continue;
        if (sinceMs && new Date(at).getTime() < sinceMs) continue;
        events.push({
          id: `paperclip-comment-${cm.id}`,
          lens: "paperclip",
          kind: "paperclip/comment-authored",
          title: `Commented on ${issue.identifier ?? issue.id.slice(0, 8)}`,
          detail: typeof cm.body === "string" ? cm.body.slice(0, 240) : null,
          importance: null,
          at,
          meta: { issueId: issue.id, commentId: cm.id, identifier: issue.identifier ?? null },
        });
      }
    }
  }
  return events;
}

export async function raceWithBudget<T>(
  promise: Promise<T[]>,
  budgetMs: number
): Promise<{ events: T[]; unavailable: boolean }> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<{ kind: "timeout" }>((resolve) => {
    timer = setTimeout(() => resolve({ kind: "timeout" }), budgetMs);
  });
  try {
    const winner = (await Promise.race([
      promise
        .then((events) => ({ kind: "ok" as const, events }))
        .catch((err) => ({
          kind: "error" as const,
          err,
        })),
      timeout,
    ])) as { kind: "ok"; events: T[] } | { kind: "error"; err: unknown } | { kind: "timeout" };

    if (winner.kind === "ok") return { events: winner.events, unavailable: false };
    if (winner.kind === "error") {
      console.warn("[humans] paperclip cross-call failed:", winner.err);
      return { events: [], unavailable: true };
    }
    console.warn("[humans] paperclip cross-call exceeded 3s budget");
    return { events: [], unavailable: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// re-export type for tests
export type { HumanRow };

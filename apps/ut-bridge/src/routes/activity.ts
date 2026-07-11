// intent: GET /agents/:agentId/activity — three-lens timeline scoped to one AGENT
// status: done — merges memories (knowledge wing), adaptations (Tekiō),
//   design-doc reviews+approvals into a unified timeline. Paperclip's own
//   activity_log lives in PGlite and is intentionally NOT joined here for
//   per-AGENT activity (cross-DB boundary). For per-AGENT Paperclip activity,
//   the UI should hit Paperclip directly.
//
//   Note: this comment scopes the no-cross-call rule to PER-AGENT activity.
//   The sibling routes/humans.ts route DOES cross-call Paperclip server-side
//   for PER-HUMAN activity merge — see its header for the rev-2 (C3) rationale.
// confidence: high

import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import { getAgent } from "../agents.js";
import { getSql } from "../db.js";

export const activityRouter: ExpressRouter = Router();

type Lens = "memory" | "tekio" | "design-doc";

interface Event {
  id: string;
  lens: Lens;
  kind: string;
  title: string;
  detail: string | null;
  importance: number | null;
  at: string;
  meta?: Record<string, unknown>;
}

activityRouter.get("/:agentId/activity", async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const since = (req.query.since as string | undefined) ?? null;
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const sql = getSql();
    const agent = await getAgent(agentId);
    if (!agent) return res.status(404).json({ error: "agent not found" });

    const tokens = [agent.name, agent.title].filter(Boolean) as string[];
    const likeAny = tokens.map((t) => `%${t}%`);

    const sinceClause = since ? new Date(since).toISOString() : null;

    const memoryRows = sinceClause
      ? ((await sql`
          SELECT id, wing, hall, category, importance, title, content, created_at
          FROM memories
          WHERE is_archived = false
            AND created_at >= ${sinceClause}
            AND (content ILIKE ANY(${likeAny}) OR title ILIKE ANY(${likeAny}))
          ORDER BY created_at DESC
          LIMIT ${limit}
        `) as any[])
      : ((await sql`
          SELECT id, wing, hall, category, importance, title, content, created_at
          FROM memories
          WHERE is_archived = false
            AND (content ILIKE ANY(${likeAny}) OR title ILIKE ANY(${likeAny}))
          ORDER BY created_at DESC
          LIMIT ${limit}
        `) as any[]);

    const adaptationRows = sinceClause
      ? ((await sql`
          SELECT id, category, severity, adaptation_rule, trigger_pattern,
                 created_at, last_applied_at, is_active, times_applied
          FROM adaptations
          WHERE created_at >= ${sinceClause}
            AND (
              trigger_pattern ILIKE ANY(${likeAny})
              OR adaptation_rule ILIKE ANY(${likeAny})
              OR source_failure ILIKE ANY(${likeAny})
            )
          ORDER BY created_at DESC
          LIMIT ${limit}
        `) as any[])
      : ((await sql`
          SELECT id, category, severity, adaptation_rule, trigger_pattern,
                 created_at, last_applied_at, is_active, times_applied
          FROM adaptations
          WHERE
              trigger_pattern ILIKE ANY(${likeAny})
              OR adaptation_rule ILIKE ANY(${likeAny})
              OR source_failure ILIKE ANY(${likeAny})
          ORDER BY created_at DESC
          LIMIT ${limit}
        `) as any[]);

    const reviewRows = sinceClause
      ? ((await sql`
          SELECT id, paperclip_issue_id, lane, verdict, comment, revision_number, created_at
          FROM design_doc_reviews
          WHERE reviewer_agent_id = ${agentId}
            AND created_at >= ${sinceClause}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `) as any[])
      : ((await sql`
          SELECT id, paperclip_issue_id, lane, verdict, comment, revision_number, created_at
          FROM design_doc_reviews
          WHERE reviewer_agent_id = ${agentId}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `) as any[]);

    const events: Event[] = [];

    for (const m of memoryRows) {
      events.push({
        id: `mem-${m.id}`,
        lens: "memory",
        kind: m.category ?? "memory",
        title: m.title ?? `${m.wing}/${m.hall}`,
        detail: typeof m.content === "string" ? m.content.slice(0, 240) : null,
        importance: m.importance ?? null,
        at: m.created_at,
        meta: { wing: m.wing, hall: m.hall },
      });
    }
    for (const a of adaptationRows) {
      events.push({
        id: `tekio-${a.id}`,
        lens: "tekio",
        kind: a.category ?? "adaptation",
        title: typeof a.adaptation_rule === "string" ? a.adaptation_rule.slice(0, 80) : "adaptation",
        detail: typeof a.trigger_pattern === "string" ? a.trigger_pattern.slice(0, 240) : null,
        importance: a.severity ?? null,
        at: a.created_at,
        meta: { active: a.is_active, timesApplied: a.times_applied },
      });
    }
    for (const r of reviewRows) {
      events.push({
        id: `review-${r.id}`,
        lens: "design-doc",
        kind: `${r.lane ?? "review"}/${r.verdict ?? "comment"}`,
        title: `Reviewed rev #${r.revision_number ?? "?"} — verdict: ${r.verdict ?? "n/a"}`,
        detail: r.comment ?? null,
        importance: null,
        at: r.created_at,
        meta: { issueId: r.paperclip_issue_id, lane: r.lane },
      });
    }

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    res.json(events.slice(0, limit));
  } catch (e: any) {
    console.error("[activity] error", e);
    res.status(500).json({ error: e?.message ?? "internal error" });
  }
});

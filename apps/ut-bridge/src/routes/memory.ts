// intent: GET /agents/:agentId/memories — UltraThink memories scoped to an agent
// status: done (v1) — uses content/title ILIKE matching against agent name/title
//   because the memories table doesn't yet have an agent_id column. v2 should
//   add agent_id via migration 023 and backfill where possible.
// next: when migration 023 lands, prefer agent_id index over content match
// confidence: high

import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import { getAgent } from "../agents.js";
import { getSql } from "../db.js";

export const memoryRouter: ExpressRouter = Router();

memoryRouter.get("/:agentId/memories", async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const search = (req.query.q as string | undefined)?.trim() || null;
    const sql = getSql();

    const agent = await getAgent(agentId);
    if (!agent) return res.status(404).json({ error: "agent not found" });

    const tokens = [agent.name, agent.title].filter(Boolean) as string[];
    if (tokens.length === 0) return res.json([]);

    // Match memories whose content/title/search_enrichment contains any
    // agent token, then dedupe + sort + truncate. Optional `q` further filters.
    const seen = new Set<string>();
    const memories: any[] = [];
    for (const token of tokens) {
      const like = `%${token}%`;
      const searchLike = search ? `%${search}%` : null;
      const rows = searchLike
        ? await sql`
            SELECT id, wing, hall, room, layer, category, importance, confidence,
                   title, content, source, created_at, updated_at, access_count,
                   token_estimate
            FROM memories
            WHERE is_archived = false
              AND (
                content ILIKE ${like}
                OR title ILIKE ${like}
                OR search_enrichment ILIKE ${like}
              )
              AND (content ILIKE ${searchLike} OR title ILIKE ${searchLike})
            ORDER BY importance DESC NULLS LAST, updated_at DESC
            LIMIT ${limit}
          `
        : await sql`
            SELECT id, wing, hall, room, layer, category, importance, confidence,
                   title, content, source, created_at, updated_at, access_count,
                   token_estimate
            FROM memories
            WHERE is_archived = false
              AND (
                content ILIKE ${like}
                OR title ILIKE ${like}
                OR search_enrichment ILIKE ${like}
              )
            ORDER BY importance DESC NULLS LAST, updated_at DESC
            LIMIT ${limit}
          `;
      for (const r of rows as any[]) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        memories.push(r);
      }
    }

    memories.sort((a, b) => {
      const ai = a.importance ?? 0;
      const bi = b.importance ?? 0;
      if (bi !== ai) return bi - ai;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    res.json(memories.slice(0, limit));
  } catch (e: any) {
    console.error("[memory] error", e);
    res.status(500).json({ error: e?.message ?? "internal error" });
  }
});

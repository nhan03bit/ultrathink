// intent: GET /agents/:agentId/skills — top skills used during this agent's sessions
// status: done (v1) — like memories, skill_usage has no agent_id column.
//   We approximate by joining skill_usage to memories whose content mentions
//   the agent name (same session_id). Returns aggregated top-N skills.
// next: phase-2 add agent_id to skill_usage so we don't need this join
// confidence: medium

import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import { getAgent } from "../agents.js";
import { getSql } from "../db.js";

export const skillsRouter: ExpressRouter = Router();

skillsRouter.get("/:agentId/skills", async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const limit = Math.min(Number(req.query.limit ?? 25), 100);
    const sql = getSql();
    const agent = await getAgent(agentId);
    if (!agent) return res.status(404).json({ error: "agent not found" });

    const tokens = [agent.name, agent.title].filter(Boolean) as string[];
    if (tokens.length === 0) return res.json([]);

    // Find sessions where any agent token appears in any memory.
    const likeAny = tokens.map((t) => `%${t}%`);
    const sessionRows = (await sql`
      SELECT DISTINCT session_id
      FROM memories
      WHERE session_id IS NOT NULL
        AND (
          content ILIKE ANY(${likeAny})
          OR title ILIKE ANY(${likeAny})
        )
    `) as Array<{ session_id: string }>;

    const sessionIds = sessionRows.map((r) => r.session_id).filter(Boolean);
    if (sessionIds.length === 0) return res.json([]);

    const skillRows = (await sql`
      SELECT
        skill_id,
        COUNT(*)::int                                    AS invocations,
        SUM(CASE WHEN success THEN 1 ELSE 0 END)::int    AS successes,
        SUM(CASE WHEN success THEN 0 ELSE 1 END)::int    AS failures,
        AVG(duration_ms)::int                            AS avg_duration_ms,
        MAX(invoked_at)                                  AS last_used_at
      FROM skill_usage
      WHERE session_id = ANY(${sessionIds})
      GROUP BY skill_id
      ORDER BY invocations DESC, last_used_at DESC
      LIMIT ${limit}
    `) as any[];

    res.json(skillRows);
  } catch (e: any) {
    console.error("[skills] error", e);
    res.status(500).json({ error: e?.message ?? "internal error" });
  }
});

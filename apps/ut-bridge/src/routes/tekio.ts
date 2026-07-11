// intent: GET /agents/:agentId/adaptations — Tekiō adaptations relevant to this agent
// status: done (v1) — matches by agent name/title appearing in trigger_pattern,
//   adaptation_rule, or source_failure. Adaptations are global today; this
//   filter returns the subset that mentions the agent.
// next: when adaptations gain agent scope, key on that
// confidence: high

import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import { getAgent } from "../agents.js";
import { getSql } from "../db.js";

export const tekioRouter: ExpressRouter = Router();

tekioRouter.get("/:agentId/adaptations", async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const onlyActive = req.query.activeOnly !== "false";
    const limit = Math.min(Number(req.query.limit ?? 100), 300);
    const sql = getSql();
    const agent = await getAgent(agentId);
    if (!agent) return res.status(404).json({ error: "agent not found" });

    const tokens = [agent.name, agent.title].filter(Boolean) as string[];
    const likeAny = tokens.map((t) => `%${t}%`);

    const rows = onlyActive
      ? await sql`
          SELECT id, trigger_pattern, adaptation_rule, source_failure, category,
                 severity, scope, times_applied, times_prevented, is_active,
                 created_at, last_applied_at, tags
          FROM adaptations
          WHERE is_active = true
            AND (
              trigger_pattern ILIKE ANY(${likeAny})
              OR adaptation_rule ILIKE ANY(${likeAny})
              OR source_failure ILIKE ANY(${likeAny})
              OR scope ILIKE ANY(${likeAny})
            )
          ORDER BY severity DESC, last_applied_at DESC NULLS LAST, created_at DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT id, trigger_pattern, adaptation_rule, source_failure, category,
                 severity, scope, times_applied, times_prevented, is_active,
                 created_at, last_applied_at, tags
          FROM adaptations
          WHERE
              trigger_pattern ILIKE ANY(${likeAny})
              OR adaptation_rule ILIKE ANY(${likeAny})
              OR source_failure ILIKE ANY(${likeAny})
              OR scope ILIKE ANY(${likeAny})
          ORDER BY severity DESC, last_applied_at DESC NULLS LAST, created_at DESC
          LIMIT ${limit}
        `;

    res.json(rows);
  } catch (e: any) {
    console.error("[tekio] error", e);
    res.status(500).json({ error: e?.message ?? "internal error" });
  }
});

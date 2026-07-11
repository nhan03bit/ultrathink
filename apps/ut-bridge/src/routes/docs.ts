// intent: GET /agents/:agentId/design-docs — design-doc activity for this agent
// status: done — joins Neon design_doc_reviews/_approvals (filtered by
//   reviewer_agent_id / approver_agent_id) with optional Paperclip issue lookup
//   for an issue title. Issue title fetch is best-effort; missing issues just
//   show the issue UUID.
// confidence: high

import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import { getSql } from "../db.js";

export const docsRouter: ExpressRouter = Router();

const PAPERCLIP_BASE = process.env.PAPERCLIP_BASE_URL ?? "http://127.0.0.1:3100";

async function fetchIssueTitle(issueId: string): Promise<string | null> {
  try {
    const r = await fetch(`${PAPERCLIP_BASE}/api/issues/${issueId}`);
    if (!r.ok) return null;
    const data = (await r.json()) as { title?: string };
    return data.title ?? null;
  } catch {
    return null;
  }
}

docsRouter.get("/:agentId/design-docs", async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const sql = getSql();

    const reviews = (await sql`
      SELECT id, paperclip_doc_id, paperclip_issue_id, paperclip_revision_id,
             revision_number, lane, verdict, comment, reviewer_agent_id,
             superseded_by, created_at
      FROM design_doc_reviews
      WHERE reviewer_agent_id = ${agentId}
      ORDER BY created_at DESC
      LIMIT 200
    `) as any[];

    const approvals = (await sql`
      SELECT id, paperclip_doc_id, paperclip_revision_id, approver_agent_id,
             decision_note, approved_at
      FROM design_doc_approvals
      WHERE approver_agent_id = ${agentId}
      ORDER BY approved_at DESC
      LIMIT 200
    `) as any[];

    const issueIds = Array.from(
      new Set(reviews.map((r) => r.paperclip_issue_id).filter((v): v is string => Boolean(v)))
    );

    const issueTitles: Record<string, string> = {};
    await Promise.all(
      issueIds.map(async (id) => {
        const title = await fetchIssueTitle(id);
        if (title) issueTitles[id] = title;
      })
    );

    res.json({ reviews, approvals, issueTitles });
  } catch (e: any) {
    console.error("[docs] error", e);
    res.status(500).json({ error: e?.message ?? "internal error" });
  }
});

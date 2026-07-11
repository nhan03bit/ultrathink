/**
 * design-doc MCP tools — 4 tools wired into the McpServer.
 *
 * Tool surface:
 *   doc_create   → upsert design-doc body in Paperclip (auto-versioned)
 *   doc_get      → fetch by "approved" | "latest" | <revision_number>
 *   doc_review   → record a lane verdict (code|quality|devops) in Neon
 *   doc_approve  → Director-only seal: requires all 3 lanes = approve
 *
 * intent: thin glue between MCP and storage.ts; no business logic leaks here
 *         except the 3-lane gate and Director identity check on doc_approve.
 * status: done
 * confidence: high
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  paperclipUpsertDoc,
  paperclipGetDoc,
  paperclipGetDocByNumber,
  recordReview,
  aggregateLaneVerdicts,
  recordApproval,
  getApprovalForRevision,
  getLatestApprovedRevisionId,
  type DesignDocSections,
  type Lane,
  type Verdict,
} from "./storage.js";

const sectionsSchema = z.object({
  what: z.string().min(1).describe("What this change does — the positive scope"),
  whatNot: z.string().min(1).describe("What this change explicitly does NOT do — out-of-scope guardrails"),
  riskGuardrails: z
    .string()
    .min(1)
    .describe("Known risks and the guardrails (rollback, feature-flag, monitoring) that contain them"),
  verificationSteps: z.string().min(1).describe("Concrete, runnable verification steps — commands, queries, or checks"),
});

function fmtJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function err(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

export function registerTools(server: McpServer) {
  /* ─── doc_create ─────────────────────────────────────────────── */
  server.tool(
    "doc_create",
    "Create or update a design-doc on a Paperclip issue. Body is the 4-section structured doc (what / whatNot / riskGuardrails / verificationSteps). Pass baseRevisionId on subsequent edits to prevent lost-update races. Paperclip auto-increments the revision number.",
    {
      issueId: z.string().uuid().describe("Paperclip issue UUID this design-doc belongs to"),
      sections: sectionsSchema,
      baseRevisionId: z
        .string()
        .uuid()
        .optional()
        .describe("Prior revision UUID this edit is based on (optimistic concurrency)"),
    },
    async ({ issueId, sections, baseRevisionId }) => {
      try {
        const doc = await paperclipUpsertDoc(issueId, sections as DesignDocSections, baseRevisionId);
        return ok(
          fmtJson({
            ok: true,
            docId: doc.id,
            issueId: doc.issueId,
            currentRevisionId: doc.currentRevisionId,
            revisionNumber: doc.revisionNumber,
            updatedAt: doc.updatedAt,
          })
        );
      } catch (e) {
        return err(`doc_create failed: ${(e as Error).message}`);
      }
    }
  );

  /* ─── doc_get ────────────────────────────────────────────────── */
  server.tool(
    "doc_get",
    "Fetch a design-doc revision. revision='approved' returns the most recently approved revision (queries design_doc_approvals first), 'latest' returns the current revision, or pass a numeric revision_number for a specific historical version.",
    {
      issueId: z.string().uuid().describe("Paperclip issue UUID"),
      revision: z
        .union([z.literal("approved"), z.literal("latest"), z.number().int().positive()])
        .default("latest")
        .describe("'approved' | 'latest' | revision number"),
    },
    async ({ issueId, revision }) => {
      try {
        if (revision === "latest") {
          const r = await paperclipGetDoc(issueId);
          return ok(
            fmtJson({
              docId: r.doc.id,
              revisionId: r.revision.id,
              revisionNumber: r.revision.revisionNumber,
              sections: r.sections,
            })
          );
        }

        if (revision === "approved") {
          // First need the doc to find docId — fetch latest meta, then look up approval.
          const head = await paperclipGetDoc(issueId);
          const approval = await getLatestApprovedRevisionId(head.doc.id);
          if (!approval) {
            return err(
              `No approved revision exists for issue ${issueId} (doc ${head.doc.id}). Run doc_approve after all 3 lanes verdict='approve'.`
            );
          }
          const r = await paperclipGetDoc(issueId, approval.paperclip_revision_id);
          return ok(
            fmtJson({
              docId: r.doc.id,
              revisionId: r.revision.id,
              revisionNumber: r.revision.revisionNumber,
              approvedAt: approval.approved_at,
              approverAgentId: approval.approver_agent_id,
              sections: r.sections,
            })
          );
        }

        // numeric revision number
        const r = await paperclipGetDocByNumber(issueId, revision);
        return ok(
          fmtJson({
            docId: r.doc.id,
            revisionId: r.revision.id,
            revisionNumber: r.revision.revisionNumber,
            sections: r.sections,
          })
        );
      } catch (e) {
        return err(`doc_get failed: ${(e as Error).message}`);
      }
    }
  );

  /* ─── doc_review ─────────────────────────────────────────────── */
  server.tool(
    "doc_review",
    "Record a lane review (code | quality | devops) for a specific revision. Re-reviewing on the same lane by the same reviewer supersedes the prior verdict (audit trail preserved via superseded_by). Returns aggregate of all 3 lane verdicts so the caller can decide whether to escalate to doc_approve.",
    {
      paperclipDocId: z.string().uuid(),
      paperclipIssueId: z.string().uuid().describe("Denormalized for recovery if Paperclip is reset"),
      paperclipRevisionId: z.string().uuid(),
      revisionNumber: z
        .number()
        .int()
        .positive()
        .describe("Denormalized revision number — recovery key paired with issueId"),
      lane: z.enum(["code", "quality", "devops"]),
      verdict: z.enum(["approve", "changes-requested", "block"]),
      comment: z.string().optional(),
      reviewerAgentId: z.string().min(1),
    },
    async ({
      paperclipDocId,
      paperclipIssueId,
      paperclipRevisionId,
      revisionNumber,
      lane,
      verdict,
      comment,
      reviewerAgentId,
    }) => {
      try {
        const row = await recordReview({
          paperclipDocId,
          paperclipIssueId,
          paperclipRevisionId,
          revisionNumber,
          lane: lane as Lane,
          verdict: verdict as Verdict,
          comment,
          reviewerAgentId,
        });
        const allLaneVerdicts = await aggregateLaneVerdicts(paperclipRevisionId);
        const lanesGreen = (["code", "quality", "devops"] as Lane[]).every(
          (l) => allLaneVerdicts[l]?.verdict === "approve"
        );
        return ok(
          fmtJson({
            review: row,
            allLaneVerdicts,
            readyForApproval: lanesGreen,
          })
        );
      } catch (e) {
        return err(`doc_review failed: ${(e as Error).message}`);
      }
    }
  );

  /* ─── doc_approve ────────────────────────────────────────────── */
  server.tool(
    "doc_approve",
    "Director-only final seal. Requires (a) approverAgentId === PAPERCLIP_DIRECTOR_AGENT_ID env, and (b) all three lanes (code, quality, devops) have an active verdict='approve' on this revision. Idempotent on (doc, revision).",
    {
      paperclipDocId: z.string().uuid(),
      paperclipRevisionId: z.string().uuid(),
      approverAgentId: z.string().min(1),
      decisionNote: z.string().optional(),
    },
    async ({ paperclipDocId, paperclipRevisionId, approverAgentId, decisionNote }) => {
      try {
        const directorId = process.env.PAPERCLIP_DIRECTOR_AGENT_ID;
        if (!directorId) {
          return err("doc_approve refused: PAPERCLIP_DIRECTOR_AGENT_ID env is not set on the MCP server.");
        }
        if (approverAgentId !== directorId) {
          return err(
            `doc_approve refused: approverAgentId ${approverAgentId} is not the configured Director (${directorId}).`
          );
        }

        const lanes = await aggregateLaneVerdicts(paperclipRevisionId);
        const missing = (["code", "quality", "devops"] as Lane[]).filter((l) => lanes[l]?.verdict !== "approve");
        if (missing.length > 0) {
          return err(
            `doc_approve refused: lanes not green: ${missing
              .map((l) => `${l}=${lanes[l]?.verdict ?? "missing"}`)
              .join(", ")}`
          );
        }

        const existing = await getApprovalForRevision(paperclipRevisionId);
        const row = await recordApproval({
          paperclipDocId,
          paperclipRevisionId,
          approverAgentId,
          decisionNote,
        });
        return ok(
          fmtJson({
            approval: row,
            wasAlreadyApproved: !!existing,
            laneVerdicts: lanes,
          })
        );
      } catch (e) {
        return err(`doc_approve failed: ${(e as Error).message}`);
      }
    }
  );
}

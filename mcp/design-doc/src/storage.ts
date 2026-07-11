/**
 * Storage layer for design-doc MCP — hybrid:
 *  - Paperclip API for doc content + revisions
 *  - UltraThink Neon for review/approval state machine
 *
 * intent: keep doc body in Paperclip (source of truth for issues + tasks);
 *         keep review/approval rows here so Paperclip stays a thin doc store.
 * status: done
 * confidence: high
 */

import { neon } from "@neondatabase/serverless";

/* ─── Neon client ────────────────────────────────────────────────── */

let sqlClient: ReturnType<typeof neon> | null = null;

export function getSql() {
  if (!sqlClient) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL environment variable is required");
    sqlClient = neon(url);
  }
  return sqlClient;
}

/* ─── Types ──────────────────────────────────────────────────────── */

export type Lane = "code" | "quality" | "devops";
export type Verdict = "approve" | "changes-requested" | "block";

export interface DesignDocSections {
  what: string;
  whatNot: string;
  riskGuardrails: string;
  verificationSteps: string;
}

export interface PaperclipDoc {
  id: string;
  issueId: string;
  key: string;
  currentRevisionId: string;
  revisionNumber: number;
  body: string; // JSON-encoded sections
  updatedAt: string;
}

export interface PaperclipRevision {
  id: string;
  documentId: string;
  revisionNumber: number;
  body: string;
  createdAt: string;
}

export interface ReviewRow {
  id: string;
  paperclip_doc_id: string;
  paperclip_issue_id: string;
  paperclip_revision_id: string;
  revision_number: number;
  lane: Lane;
  verdict: Verdict;
  comment: string | null;
  reviewer_agent_id: string;
  superseded_by: string | null;
  created_at: string;
}

export interface ApprovalRow {
  id: string;
  paperclip_doc_id: string;
  paperclip_revision_id: string;
  approver_agent_id: string;
  decision_note: string | null;
  approved_at: string;
}

/* ─── Paperclip HTTP client ──────────────────────────────────────── */

function paperclipBase(): string {
  const url = process.env.PAPERCLIP_API_URL || "http://127.0.0.1:3100";
  return url.replace(/\/$/, "");
}

function paperclipHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = process.env.PAPERCLIP_API_KEY;
  if (key) headers["Authorization"] = `Bearer ${key}`;
  return headers;
}

async function paperclipFetch(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${paperclipBase()}${path}`, {
    ...init,
    headers: { ...paperclipHeaders(), ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Paperclip ${init?.method || "GET"} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

const DOC_KEY = "design-doc";

/**
 * Upsert the design-doc on an issue. Paperclip auto-increments revision number.
 * Pass `baseRevisionId` for optimistic concurrency on subsequent edits.
 */
export async function paperclipUpsertDoc(
  issueId: string,
  sections: DesignDocSections,
  baseRevisionId?: string
): Promise<PaperclipDoc> {
  const body = JSON.stringify(sections);
  const payload: Record<string, unknown> = { body };
  if (baseRevisionId) payload.baseRevisionId = baseRevisionId;
  const res = (await paperclipFetch(`/api/issues/${issueId}/documents/${DOC_KEY}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })) as { document: PaperclipDoc };
  return res.document;
}

/** Fetch the current (or specific) revision of an issue's design-doc. */
export async function paperclipGetDoc(
  issueId: string,
  revisionId?: string
): Promise<{ doc: PaperclipDoc; revision: PaperclipRevision; sections: DesignDocSections }> {
  const qs = revisionId ? `?revisionId=${encodeURIComponent(revisionId)}` : "";
  const res = (await paperclipFetch(`/api/issues/${issueId}/documents/${DOC_KEY}${qs}`)) as {
    document: PaperclipDoc;
    revision: PaperclipRevision;
  };
  let sections: DesignDocSections;
  try {
    sections = JSON.parse(res.revision.body) as DesignDocSections;
  } catch {
    sections = { what: res.revision.body, whatNot: "", riskGuardrails: "", verificationSteps: "" };
  }
  return { doc: res.document, revision: res.revision, sections };
}

/** Fetch a specific revision number for an issue's design-doc. */
export async function paperclipGetDocByNumber(
  issueId: string,
  revisionNumber: number
): Promise<{ doc: PaperclipDoc; revision: PaperclipRevision; sections: DesignDocSections }> {
  const res = (await paperclipFetch(`/api/issues/${issueId}/documents/${DOC_KEY}/revisions/${revisionNumber}`)) as {
    document: PaperclipDoc;
    revision: PaperclipRevision;
  };
  let sections: DesignDocSections;
  try {
    sections = JSON.parse(res.revision.body) as DesignDocSections;
  } catch {
    sections = { what: res.revision.body, whatNot: "", riskGuardrails: "", verificationSteps: "" };
  }
  return { doc: res.document, revision: res.revision, sections };
}

/* ─── Neon: review state ─────────────────────────────────────────── */

/**
 * Record a lane review. If the same (doc, revision, lane, reviewer) already has
 * an active row, mark it superseded before inserting the new one so we keep an
 * audit trail of how a reviewer's verdict evolved.
 */
export async function recordReview(input: {
  paperclipDocId: string;
  paperclipIssueId: string;
  paperclipRevisionId: string;
  revisionNumber: number;
  lane: Lane;
  verdict: Verdict;
  comment?: string;
  reviewerAgentId: string;
}): Promise<ReviewRow> {
  const sql = getSql();

  const inserted = (await sql`
    INSERT INTO design_doc_reviews
      (paperclip_doc_id, paperclip_issue_id, paperclip_revision_id, revision_number,
       lane, verdict, comment, reviewer_agent_id)
    VALUES
      (${input.paperclipDocId}, ${input.paperclipIssueId}, ${input.paperclipRevisionId},
       ${input.revisionNumber}, ${input.lane}, ${input.verdict},
       ${input.comment ?? null}, ${input.reviewerAgentId})
    RETURNING *
  `) as ReviewRow[];

  const newRow = inserted[0];

  // Supersede any prior active reviews from this same reviewer on this revision+lane.
  await sql`
    UPDATE design_doc_reviews
       SET superseded_by = ${newRow.id}
     WHERE paperclip_revision_id = ${input.paperclipRevisionId}
       AND lane = ${input.lane}
       AND reviewer_agent_id = ${input.reviewerAgentId}
       AND id <> ${newRow.id}
       AND superseded_by IS NULL
  `;

  return newRow;
}

/**
 * Aggregate the active (non-superseded) verdicts for a revision, grouped by lane.
 * Returns the latest active row per (lane) — if multiple reviewers covered one
 * lane, the most recent active wins.
 */
export async function aggregateLaneVerdicts(
  paperclipRevisionId: string
): Promise<Record<Lane, { verdict: Verdict; reviewer: string; createdAt: string } | null>> {
  const sql = getSql();
  const rows = (await sql`
    SELECT DISTINCT ON (lane) lane, verdict, reviewer_agent_id, created_at
      FROM design_doc_reviews
     WHERE paperclip_revision_id = ${paperclipRevisionId}
       AND superseded_by IS NULL
  ORDER BY lane, created_at DESC
  `) as { lane: Lane; verdict: Verdict; reviewer_agent_id: string; created_at: string }[];

  const out: Record<Lane, { verdict: Verdict; reviewer: string; createdAt: string } | null> = {
    code: null,
    quality: null,
    devops: null,
  };
  for (const r of rows) {
    out[r.lane] = { verdict: r.verdict, reviewer: r.reviewer_agent_id, createdAt: r.created_at };
  }
  return out;
}

export async function recordApproval(input: {
  paperclipDocId: string;
  paperclipRevisionId: string;
  approverAgentId: string;
  decisionNote?: string;
}): Promise<ApprovalRow> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO design_doc_approvals
      (paperclip_doc_id, paperclip_revision_id, approver_agent_id, decision_note)
    VALUES
      (${input.paperclipDocId}, ${input.paperclipRevisionId},
       ${input.approverAgentId}, ${input.decisionNote ?? null})
    ON CONFLICT (paperclip_doc_id, paperclip_revision_id) DO UPDATE
      SET decision_note = EXCLUDED.decision_note,
          approver_agent_id = EXCLUDED.approver_agent_id,
          approved_at = now()
    RETURNING *
  `) as ApprovalRow[];
  return rows[0];
}

export async function getApprovalForRevision(paperclipRevisionId: string): Promise<ApprovalRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM design_doc_approvals
     WHERE paperclip_revision_id = ${paperclipRevisionId}
     LIMIT 1
  `) as ApprovalRow[];
  return rows[0] ?? null;
}

/** Most recent approved revision id for a given doc. */
export async function getLatestApprovedRevisionId(paperclipDocId: string): Promise<ApprovalRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM design_doc_approvals
     WHERE paperclip_doc_id = ${paperclipDocId}
  ORDER BY approved_at DESC
     LIMIT 1
  `) as ApprovalRow[];
  return rows[0] ?? null;
}

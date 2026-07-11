-- intent: design-doc review/approval state machine (Org-Bench Google-bipartite winning mechanism)
-- status: done
-- confidence: high
-- Hybrid storage: doc CONTENT lives in Paperclip; REVIEW STATE lives here.
-- Denormalize paperclip_issue_id + revision_number on every row so we can recover
-- review references via (issue_id, revision_number) tuple even if Paperclip's doc UUIDs
-- get reset on a fresh export/import cycle.

CREATE TABLE IF NOT EXISTS design_doc_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paperclip_doc_id UUID NOT NULL,
  paperclip_issue_id UUID NOT NULL,
  paperclip_revision_id UUID NOT NULL,
  revision_number INTEGER NOT NULL,
  lane TEXT NOT NULL CHECK (lane IN ('code', 'quality', 'devops')),
  verdict TEXT NOT NULL CHECK (verdict IN ('approve', 'changes-requested', 'block')),
  comment TEXT,
  reviewer_agent_id TEXT NOT NULL,
  superseded_by UUID REFERENCES design_doc_reviews(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ddr_doc_lane ON design_doc_reviews(paperclip_doc_id, lane, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ddr_issue_revnum ON design_doc_reviews(paperclip_issue_id, revision_number);

CREATE TABLE IF NOT EXISTS design_doc_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paperclip_doc_id UUID NOT NULL,
  paperclip_revision_id UUID NOT NULL,
  approver_agent_id TEXT NOT NULL,
  decision_note TEXT,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(paperclip_doc_id, paperclip_revision_id)
);
CREATE INDEX IF NOT EXISTS idx_dda_doc ON design_doc_approvals(paperclip_doc_id, approved_at DESC);

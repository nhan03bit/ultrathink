-- intent: M7 activity feed — single chronological log of every meaningful action across UltraThink + Paperclip.
-- status: done
-- confidence: high
-- Backfilled by the transparency plugin (M4) that subscribes to Paperclip's event bus.
-- Read by the dashboard's /orchestrator/activity page which slices it via four lenses:
--   done | next-up | agents-did | human->agent | humans-direct.

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Actor: who did this
  actor_type TEXT NOT NULL CHECK (actor_type IN ('agent', 'human', 'system')),
  actor_id TEXT,                   -- agent UUID, human UUID, or 'system' literal
  actor_name TEXT NOT NULL,        -- "Steven", "Daniel", "system"
  actor_title TEXT,                -- "CEO" for agents, NULL for humans/system

  -- Trigger: what caused this action to happen
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('direct', 'human_mention', 'agent_handoff', 'scheduled', 'system')),
  triggered_by_actor_type TEXT CHECK (triggered_by_actor_type IN ('agent', 'human', 'system')),
  triggered_by_actor_id TEXT,
  triggered_by_actor_name TEXT,    -- denormalized for fast lens queries

  -- Action: what they did
  verb TEXT NOT NULL,              -- 'created', 'commented', 'reviewed', 'approved', 'completed', 'cancelled', 'blocked', 'wake', 'shipped', 'mentioned', 'assigned', 'errored', 'budget_exceeded'
  object_type TEXT,                -- 'issue', 'document', 'review', 'approval', 'run', 'pr', 'comment', 'budget', 'agent'
  object_id TEXT,                  -- usually a UUID
  object_label TEXT,               -- "INU-16" or "PR #235" — human-readable

  -- Scope: where it happened
  paperclip_company_id UUID,
  project_id UUID,
  issue_id UUID,
  paperclip_run_id UUID,

  -- Extras
  cost_usd NUMERIC(10, 4),         -- if verb='completed' on a run, the run's cost
  metadata JSONB DEFAULT '{}'      -- anything else worth keeping
);

-- Indexes for the four lenses
CREATE INDEX IF NOT EXISTS idx_activity_log_occurred_at ON activity_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON activity_log(actor_type, actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_issue ON activity_log(issue_id, occurred_at DESC) WHERE issue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_log_project ON activity_log(project_id, occurred_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_log_trigger ON activity_log(trigger_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_verb ON activity_log(verb, occurred_at DESC);

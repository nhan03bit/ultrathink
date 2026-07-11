-- 024_agent_attribution: per-agent dashboard tabs need exact-match data
-- Adds agent_id + paperclip_run_id columns. Backfill of historical rows
-- intentionally not attempted — those stay NULL and surface via the v1
-- ILIKE name fallback in apps/ut-bridge.

SET search_path TO public;

ALTER TABLE skill_usage ADD COLUMN IF NOT EXISTS agent_id         TEXT;
ALTER TABLE skill_usage ADD COLUMN IF NOT EXISTS paperclip_run_id TEXT;
ALTER TABLE memories    ADD COLUMN IF NOT EXISTS agent_id         TEXT;
ALTER TABLE memories    ADD COLUMN IF NOT EXISTS paperclip_run_id TEXT;
ALTER TABLE adaptations ADD COLUMN IF NOT EXISTS agent_id         TEXT;

CREATE INDEX IF NOT EXISTS idx_skill_usage_agent ON skill_usage(agent_id, invoked_at DESC) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_skill_usage_run   ON skill_usage(paperclip_run_id)          WHERE paperclip_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memories_agent    ON memories(agent_id, created_at DESC)    WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_adaptations_agent ON adaptations(agent_id, created_at DESC) WHERE agent_id IS NOT NULL;

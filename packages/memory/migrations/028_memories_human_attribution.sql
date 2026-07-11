-- 028_memories_human_attribution.sql
-- INU-45 — splits the memory-attribution column out of INU-21 rev 2.
-- Adds `memories.created_by_human_id` so apps/ut-bridge `humans.ts:fetchMemoryEvents`
-- can drop its missing-column try/catch and light up the memory side of
-- `recent_activity` on the People page.
--
-- Backfill: NULL for all existing rows. There is no automatic source — the
-- column is populated going forward by memory-write paths that have a known
-- human originator. Rewriting those writers is intentionally out of scope.
--
-- Additive, idempotent. Forward-only runner (memory/scripts/migrate.ts);
-- rollback DDL lives in migrations/rollback/028_memories_human_attribution.sql.

ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS created_by_human_id UUID REFERENCES humans(id);

CREATE INDEX IF NOT EXISTS idx_memories_created_by_human_id
  ON memories(created_by_human_id)
  WHERE created_by_human_id IS NOT NULL;

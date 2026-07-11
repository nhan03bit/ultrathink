-- 026_discord_issue_threads.sql
-- INU-41 / INU-24 design doc rev 2 — Discord bot persistence.
-- Persists the Discord-thread <-> Paperclip-issue mapping that the bot writes
-- before replying to a mapped human's mention. Lazy-rehydrated on every
-- message: the bot does not maintain in-memory state for thread linkage.
--
-- Additive, idempotent. Forward-only runner (memory/scripts/migrate.ts);
-- rollback DDL lives in migrations/rollback/026_discord_issue_threads.sql.

CREATE TABLE IF NOT EXISTS discord_issue_threads (
  thread_id           TEXT        PRIMARY KEY,
  issue_id            TEXT        NOT NULL,
  channel_id          TEXT        NOT NULL,
  created_by_human_id UUID        REFERENCES humans(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dit_issue ON discord_issue_threads(issue_id);

-- rollback/026_discord_issue_threads.sql — paired with migrations/026_*.
-- Run manually via `psql $DATABASE_URL -f memory/migrations/rollback/026_discord_issue_threads.sql`.
-- Forward migration runner skips this directory.

DROP INDEX IF EXISTS idx_dit_issue;
DROP TABLE IF EXISTS discord_issue_threads;

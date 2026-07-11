-- rollback/027_human_focus_state.sql — paired with migrations/027_*.
-- Run manually via `psql $DATABASE_URL -f memory/migrations/rollback/027_human_focus_state.sql`.
-- Forward migration runner skips this directory.

DROP TABLE IF EXISTS human_focus_state;

-- 027_human_focus_state.sql
-- INU-41 / INU-24 design doc rev 2 — Discord bot `/focus <duration>`.
-- Caller-scoped focus mode: human_id is the PK so re-running /focus replaces
-- the previous expiry. `scope` reserved for future per-channel/per-feature
-- focus filters; bot writes `{}` today.

CREATE TABLE IF NOT EXISTS human_focus_state (
  human_id   UUID        PRIMARY KEY REFERENCES humans(id),
  expires_at TIMESTAMPTZ NOT NULL,
  scope      JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 022_humans.sql
-- M6: Naming convention enforcement
-- Adds the `humans` table to the UltraThink Neon DB so non-agent actors
-- can be represented in the same Actor model used by the dashboard,
-- Discord bot, and CLI. Agents already live in Paperclip's DB; this
-- table is the mirror for real people. No title column on purpose:
-- humans render as `Name`, agents render as `Name [Title]`.

CREATE TABLE IF NOT EXISTS humans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  discord_user_id TEXT UNIQUE,
  github_username TEXT,
  timezone TEXT DEFAULT 'UTC',
  working_hours_start TIME DEFAULT '09:00',
  working_hours_end TIME DEFAULT '17:00',
  reports_to UUID REFERENCES humans(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_humans_discord ON humans(discord_user_id) WHERE discord_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_humans_email ON humans(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_humans_active ON humans(is_active) WHERE is_active = TRUE;

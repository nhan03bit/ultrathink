-- 025_humans_paperclip_link: cross-DB linkage between humans (UltraThink Neon) and user (Paperclip PGlite)
-- The humans.paperclip_user_id is set to the Paperclip user.id of the same person, when known.
-- Idempotent.

SET search_path TO public;

ALTER TABLE humans ADD COLUMN IF NOT EXISTS paperclip_user_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_humans_paperclip ON humans(paperclip_user_id) WHERE paperclip_user_id IS NOT NULL;

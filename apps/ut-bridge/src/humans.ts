// intent: resolve humans (UltraThink Neon) by id with a 5min in-process cache,
//   mirroring the getAgents() pattern in agents.ts:32-37. Keeps the bridge
//   self-contained — humans live in our Neon DB, agents in Paperclip's.
// status: done — covers list + by-id lookup, force-bust supported.
// confidence: high

import { getSql } from "./db.js";

const TTL_MS = 5 * 60 * 1000;

export type HumanRow = {
  id: string;
  name: string;
  email: string | null;
  github_username: string | null;
  timezone: string;
  working_hours_start: string;
  working_hours_end: string;
  reports_to: string | null;
  is_active: boolean;
  paperclip_user_id: string | null;
  discord_user_id: string | null;
  created_at: string;
  updated_at: string;
};

let cache: { at: number; rows: HumanRow[] } | null = null;

async function fetchHumans(): Promise<HumanRow[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, name, email, github_username, timezone,
           to_char(working_hours_start, 'HH24:MI') AS working_hours_start,
           to_char(working_hours_end,   'HH24:MI') AS working_hours_end,
           reports_to, is_active, paperclip_user_id, discord_user_id,
           created_at, updated_at
    FROM humans
    ORDER BY is_active DESC, name ASC
  `) as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email ?? null,
    github_username: r.github_username ?? null,
    timezone: r.timezone ?? "UTC",
    working_hours_start: r.working_hours_start ?? "09:00",
    working_hours_end: r.working_hours_end ?? "17:00",
    reports_to: r.reports_to ?? null,
    is_active: Boolean(r.is_active),
    paperclip_user_id: r.paperclip_user_id ?? null,
    discord_user_id: r.discord_user_id ?? null,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  }));
}

export async function getHumans(force = false): Promise<HumanRow[]> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const rows = await fetchHumans();
  cache = { at: Date.now(), rows };
  return rows;
}

export async function getHuman(id: string, force = false): Promise<HumanRow | null> {
  const rows = await getHumans(force);
  return rows.find((r) => r.id === id) ?? null;
}

export async function getHumanByDiscordId(discordUserId: string, force = false): Promise<HumanRow | null> {
  const rows = await getHumans(force);
  return rows.find((r) => r.discord_user_id === discordUserId) ?? null;
}

// test-only — reset the in-process cache between tests
export function __resetHumansCacheForTests(): void {
  cache = null;
}

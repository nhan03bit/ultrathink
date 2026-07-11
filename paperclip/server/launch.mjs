#!/usr/bin/env node
// intent: Boot the vendored Paperclip server against the existing default instance.
// status: done
// next: nothing — invoke directly with `node paperclip/server/launch.mjs`
// confidence: high
//
// The dist/index.js exports startServer() but does not auto-invoke it (unlike
// the published `paperclipai` CLI which has its own bootstrapper). This wrapper
// imports the export and runs it with the same env auto-apply switches the
// `paperclipai onboard --yes` flow sets.
//
// Critical: we MUST scrub DATABASE_URL before the server's config loader runs.
// The server calls loadDotenv on process.cwd()/.env, which on the ultrathink
// workspace contains a Neon connection string for UltraThink's memory DB —
// totally unrelated to Paperclip. Without scrubbing, the server connects to
// Neon instead of the local embedded postgres at port 54329 and crashes with
// "Database has tables but no migration journal" because the Neon DB has 30
// unrelated tables but zero Paperclip migration history.
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Setting to empty string (not delete) is required: the server uses
// `loadDotenv({ override: false })` which would *re-populate* DATABASE_URL
// from process.cwd()/.env if we merely deleted it. An empty string remains
// set and dotenv leaves it alone; downstream `??` logic and the `if
// (config.databaseUrl)` truthy check both treat "" as absent.
process.env.DATABASE_URL = "";

// Same trick for PORT: the workspace .env sets PORT=3333 for the dashboard.
// Empty string makes `Number(process.env.PORT) || fileConfig?.server.port || 3100`
// fall through to config.json's 3100.
process.env.PORT = "";

// Auto-apply migrations non-interactively (matches `paperclipai onboard --yes`).
process.env.PAPERCLIP_MIGRATION_AUTO_APPLY ??= "true";
process.env.PAPERCLIP_MIGRATION_PROMPT ??= "never";

// Pin to the canonical Paperclip home so cwd-walk config discovery can't pick
// up a stray .paperclip/ in the workspace tree.
process.env.PAPERCLIP_HOME ??= `${process.env.HOME}/.paperclip`;
process.env.PAPERCLIP_INSTANCE_ID ??= "default";

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, "dist/index.js");
const mod = await import(entry);
if (typeof mod.startServer !== "function") {
  console.error("vendored server did not export startServer()");
  process.exit(1);
}
await mod.startServer();

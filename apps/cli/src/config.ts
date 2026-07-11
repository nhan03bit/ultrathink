// intent: env loading + constants for ut CLI
// status: done
// next: extend with ULTRATHINK_HOME for relocation
// confidence: high
//
// Loads the project root .env so DATABASE_URL, PAPERCLIP_API_URL, COMPANY_ID
// are visible regardless of where `ut` is run from. We always resolve to the
// pinned UltraThink repo root unless overridden.

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = process.env.ULTRATHINK_HOME || "/Users/inugami/Documents/GitHub/InuVerse/ai-agents/ultrathink";

const ENV_PATH = join(REPO_ROOT, ".env");
if (existsSync(ENV_PATH)) {
  loadEnv({ path: ENV_PATH });
}

export const PAPERCLIP_API_URL = process.env.PAPERCLIP_API_URL || "http://127.0.0.1:3100";

export const COMPANY_ID =
  process.env.PAPERCLIP_COMPANY_ID || process.env.COMPANY_ID || "230c703d-eb8b-4872-aad9-9b3495eb6d59";

export const DATABASE_URL = process.env.DATABASE_URL || "";

export const DIRECTOR_AGENT_ID = process.env.PAPERCLIP_DIRECTOR_AGENT_ID || "49da6c47-00e9-4f72-ac8b-0b6e873d4ec8";

export const ULTRATHINK_ROOT = resolve(REPO_ROOT);

export interface Config {
  paperclipApiUrl: string;
  companyId: string;
  databaseUrl: string;
  directorAgentId: string;
  repoRoot: string;
}

export function getConfig(): Config {
  return {
    paperclipApiUrl: PAPERCLIP_API_URL,
    companyId: COMPANY_ID,
    databaseUrl: DATABASE_URL,
    directorAgentId: DIRECTOR_AGENT_ID,
    repoRoot: ULTRATHINK_ROOT,
  };
}

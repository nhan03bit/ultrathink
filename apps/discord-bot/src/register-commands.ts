// intent: idempotent guild slash-command registration (doc rev 2 step 5).
//   Computes a SHA-256 hex digest of the serialized command definitions and
//   compares it against `.discord-cmd-hash` (a gitignored file in the app root).
//   Only calls REST.put() when the hash changes or the file is absent. This
//   prevents unnecessary bulk-PUT requests that would hit the Discord rate limit
//   on every bot restart.
//
//   `register-fail` is NOT fatal — the bot starts and continues to operate with
//   whatever commands Discord already has registered. The caller should log the
//   error but must NOT re-throw it (doc rev 2 / Alex T3 review note).
// status: done
// confidence: high

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// The hash file lives in the app root, next to package.json.
const APP_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const HASH_FILE = join(APP_ROOT, ".discord-cmd-hash");

export interface SlashCommandDef {
  name: string;
  description: string;
  options?: unknown[];
}

function computeHash(commands: SlashCommandDef[]): string {
  return createHash("sha256").update(JSON.stringify(commands)).digest("hex");
}

function readStoredHash(): string | null {
  try {
    return readFileSync(HASH_FILE, "utf8").trim();
  } catch {
    return null;
  }
}

function writeStoredHash(hash: string): void {
  try {
    writeFileSync(HASH_FILE, hash + "\n", "utf8");
  } catch (e: any) {
    console.warn("[register-commands] could not write hash file:", e?.message ?? e);
  }
}

// registerCommandsIfChanged returns true when it issued a bulk PUT, false when
// it was a no-op (hash match), and throws ONLY if the REST call itself fails —
// the caller is responsible for deciding whether to swallow that error.
export async function registerCommandsIfChanged(
  restPut: (commands: SlashCommandDef[]) => Promise<void>,
  commands: SlashCommandDef[]
): Promise<boolean> {
  const hash = computeHash(commands);
  const stored = readStoredHash();
  if (stored === hash) {
    console.log("[register-commands] command hash unchanged — skipping bulk PUT");
    return false;
  }
  console.log(
    `[register-commands] hash changed (${stored ?? "none"} → ${hash}) — registering ${commands.length} commands`
  );
  await restPut(commands);
  writeStoredHash(hash);
  return true;
}

// buildRestPut wraps the discord.js REST client so the caller in index.ts can
// pass a simple closure without importing discord.js types into this module.
// The `rest` parameter is typed as `any` intentionally — this file must NOT
// import discord.js at module-load time (boot-order invariant, step 4).
export function buildRestPut(
  rest: any,
  appId: string,
  guildId: string
): (commands: SlashCommandDef[]) => Promise<void> {
  return async (commands) => {
    const { Routes } = await import("discord.js");
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
  };
}

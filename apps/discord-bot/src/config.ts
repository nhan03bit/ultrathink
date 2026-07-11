// intent: zod-parsed env for the discord-bot. Two phases:
//   - parseEnvShape() reads process.env and returns a partially-validated
//     object. The DISCORD_BOT_ENABLED flag is intentionally evaluated FIRST,
//     before any discord.js or token-shaped fields are required, so the
//     boot-order gate (doc rev 2 / Quinn race-4 + Alex T1) can short-circuit
//     without tripping zod failures on missing tokens.
//   - parseFullEnv() requires every field a live boot needs. Called only
//     after the flag check passes.
// status: scaffold — schemas + parsers in place; no live boot yet.
// confidence: high

import { z } from "zod";

// Phase 1: minimal — only the flag matters here. Defaults `false`.
const FlagSchema = z.object({
  DISCORD_BOT_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export type FlagEnv = z.infer<typeof FlagSchema>;

export function parseFlagEnv(env: NodeJS.ProcessEnv = process.env): FlagEnv {
  return FlagSchema.parse({ DISCORD_BOT_ENABLED: env.DISCORD_BOT_ENABLED });
}

// Phase 2: full — required for live boot. Endpoint URLs default to local.
const FullEnvSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(20, "DISCORD_BOT_TOKEN missing"),
  DISCORD_APP_ID: z.string().min(1, "DISCORD_APP_ID missing"),
  DISCORD_GUILD_ID: z.string().min(1, "DISCORD_GUILD_ID missing"),
  PAPERCLIP_API_URL: z.string().url().default("http://127.0.0.1:3100"),
  PAPERCLIP_API_KEY: z.string().min(1, "PAPERCLIP_API_KEY missing"),
  PAPERCLIP_COMPANY_ID: z.string().min(1, "PAPERCLIP_COMPANY_ID missing"),
  UT_BRIDGE_URL: z.string().url().default("http://127.0.0.1:3201"),
});

export type FullEnv = z.infer<typeof FullEnvSchema>;

export function parseFullEnv(env: NodeJS.ProcessEnv = process.env): FullEnv {
  return FullEnvSchema.parse({
    DISCORD_BOT_TOKEN: env.DISCORD_BOT_TOKEN,
    DISCORD_APP_ID: env.DISCORD_APP_ID,
    DISCORD_GUILD_ID: env.DISCORD_GUILD_ID,
    PAPERCLIP_API_URL: env.PAPERCLIP_API_URL ?? "http://127.0.0.1:3100",
    PAPERCLIP_API_KEY: env.PAPERCLIP_API_KEY,
    PAPERCLIP_COMPANY_ID: env.PAPERCLIP_COMPANY_ID,
    UT_BRIDGE_URL: env.UT_BRIDGE_URL ?? "http://127.0.0.1:3201",
  });
}

// Boot-error taxonomy (doc rev 2 / Alex T3 + supervisor back-off enumeration).
// register-fail is intentionally NOT in the fatal exit set — see index.ts.
export type BootErrorCategory =
  | "bad-token"
  | "missing-intent"
  | "missing-env"
  | "register-fail"
  | "discord-unreachable"
  | "discord-login-failed"
  | "paperclip-unreachable"
  | "ut-bridge-unreachable"
  | "flag-disabled";

export class BootError extends Error {
  readonly category: BootErrorCategory;
  constructor(category: BootErrorCategory, message: string) {
    super(`boot-error: ${category} — ${message}`);
    this.category = category;
    this.name = "BootError";
  }
}

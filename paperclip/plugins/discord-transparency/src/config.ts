// intent: load Discord webhook URLs from plugin config OR env vars, with
//   `DISCORD_WEBHOOK_*` env taking precedence so operators can override the
//   plugin config at runtime without rebuilding.
// status: done
// next: integrate ctx.secrets.read-ref to allow webhook URLs to live in
//   Paperclip's secret store instead of plain config (follow-up subagent).
// confidence: high

import { z } from "zod";

export const ChannelKey = z.enum(["feed", "agents", "humans", "humanAgent", "alerts", "designDocs"]);
export type ChannelKey = z.infer<typeof ChannelKey>;

export const PluginConfigSchema = z.object({
  webhooks: z
    .object({
      feed: z.string().url().optional(),
      agents: z.string().url().optional(),
      humans: z.string().url().optional(),
      humanAgent: z.string().url().optional(),
      alerts: z.string().url().optional(),
      designDocs: z.string().url().optional(),
    })
    .partial()
    .default({}),
  minRunCostUsd: z.number().nonnegative().default(0.5),
  directorMention: z.string().default(""),
});
export type PluginConfig = z.infer<typeof PluginConfigSchema>;

const ENV_VARS: Record<ChannelKey, string> = {
  feed: "DISCORD_WEBHOOK_FEED",
  agents: "DISCORD_WEBHOOK_AGENTS",
  humans: "DISCORD_WEBHOOK_HUMANS",
  humanAgent: "DISCORD_WEBHOOK_HUMAN_AGENT",
  alerts: "DISCORD_WEBHOOK_ALERTS",
  designDocs: "DISCORD_WEBHOOK_DESIGN_DOCS",
};

export type ResolvedConfig = {
  webhooks: Partial<Record<ChannelKey, string>>;
  minRunCostUsd: number;
  directorMention: string;
};

/**
 * Merge plugin config + environment overrides. Env vars win.
 */
export function resolveConfig(raw: unknown): ResolvedConfig {
  const parsed = PluginConfigSchema.safeParse(raw ?? {});
  const cfg: PluginConfig = parsed.success ? parsed.data : { webhooks: {}, minRunCostUsd: 0.5, directorMention: "" };

  const webhooks: Partial<Record<ChannelKey, string>> = { ...cfg.webhooks };
  for (const [key, envName] of Object.entries(ENV_VARS) as [ChannelKey, string][]) {
    const fromEnv = process.env[envName];
    if (fromEnv && fromEnv.trim()) webhooks[key] = fromEnv.trim();
  }

  const directorMention = process.env.DISCORD_DIRECTOR_MENTION?.trim() || cfg.directorMention;
  const minRunCostUsd = process.env.DISCORD_MIN_RUN_COST_USD
    ? Number(process.env.DISCORD_MIN_RUN_COST_USD)
    : cfg.minRunCostUsd;

  return {
    webhooks,
    minRunCostUsd: Number.isFinite(minRunCostUsd) ? minRunCostUsd : 0.5,
    directorMention,
  };
}

export function listChannelKeys(): ChannelKey[] {
  return ["feed", "agents", "humans", "humanAgent", "alerts", "designDocs"];
}

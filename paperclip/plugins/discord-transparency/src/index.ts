// intent: Paperclip plugin worker entry. Subscribes to the event bus and
//   relays each meaningful event to one or more Discord channels.
// status: partially_done — wires up registration + handler dispatch and
//   subscribes to the events listed in event-router.SUBSCRIBED_EVENTS.
//   The follow-up subagent will broaden coverage, add deduping/queueing,
//   and wire ctx.secrets for webhook URLs.
// next: per-event filters (project / company), retry queue, vault sync
// confidence: medium

import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import { resolveConfig, type ResolvedConfig } from "./config.js";
import { buildEmbed, type DiscordEmbed, type EventEnvelope } from "./embed-builder.js";
import { routeEvent, LIVE_SUBSCRIBED_EVENTS, type LiveSubscribedEvent } from "./event-router.js";
import { startPoller, type PollerContext } from "./poller.js";
import { WebhookClient, type Logger } from "./webhook-client.js";

/**
 * Normalize whatever the host hands the handler into our local EventEnvelope
 * shape. The Paperclip SDK exposes events as `(event) => unknown`, so this
 * adapter is intentionally permissive.
 */
function toEnvelope(name: string, raw: unknown): EventEnvelope {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const payload =
    (obj["data"] as Record<string, unknown> | undefined) ??
    (obj["payload"] as Record<string, unknown> | undefined) ??
    obj;
  const actor =
    (obj["actor"] as Record<string, unknown> | undefined) ??
    (payload?.["actor"] as Record<string, unknown> | undefined) ??
    null;
  const triggerType =
    (obj["triggerType"] as string | undefined) ?? (payload?.["triggerType"] as string | undefined) ?? null;

  return {
    name,
    id: (obj["id"] as string | undefined) ?? undefined,
    occurredAt:
      (obj["occurredAt"] as string | undefined) ?? (obj["timestamp"] as string | undefined) ?? new Date().toISOString(),
    companyId: obj["companyId"] as string | undefined,
    projectId: (obj["projectId"] as string | undefined) ?? (payload?.["projectId"] as string | undefined),
    entityId:
      (obj["entityId"] as string | undefined) ??
      (payload?.["id"] as string | undefined) ??
      (payload?.["issueId"] as string | undefined),
    entityType: obj["entityType"] as string | undefined,
    payload,
    actor: actor as EventEnvelope["actor"],
    triggerType,
    hostUrl: process.env.PAPERCLIP_PUBLIC_URL,
  };
}

/**
 * Dispatch a single event: build the embed, decide channels, post.
 */
export async function dispatchEvent(
  env: EventEnvelope,
  config: ResolvedConfig,
  webhooks: WebhookClient,
  logger: Logger
): Promise<void> {
  const decision = routeEvent(env, {
    minRunCostUsd: config.minRunCostUsd,
    directorMention: config.directorMention,
  });
  if (decision.suppress || decision.channels.length === 0) {
    logger.info(`[discord-transparency] suppressed ${env.name}`, {
      eventName: env.name,
    });
    return;
  }
  const embed = buildEmbed(env, { alertMention: decision.alertMention });
  if (!embed) return;
  const embeds: DiscordEmbed[] = [embed];

  await Promise.all(
    decision.channels.map(async (channel) => {
      const result = await webhooks.post(channel, embeds);
      if (result.status === "error") {
        logger.error(`[discord-transparency] dispatch error`, {
          channel,
          eventName: env.name,
          error: result.error,
        });
      }
    })
  );
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = resolveConfig(ctx.config);
    const logger: Logger = {
      info: (msg, meta) => ctx.logger.info(msg, meta ?? {}),
      warn: (msg, meta) => ctx.logger.warn(msg, meta ?? {}),
      error: (msg, meta) => ctx.logger.error(msg, meta ?? {}),
    };
    const webhooks = new WebhookClient({ webhooks: config.webhooks, logger });

    ctx.logger.info("[discord-transparency] starting", {
      configuredChannels: Object.keys(config.webhooks),
      minRunCostUsd: config.minRunCostUsd,
    });

    for (const eventName of LIVE_SUBSCRIBED_EVENTS) {
      ctx.events.on(eventName, async (raw: unknown) => {
        try {
          const env = toEnvelope(eventName as LiveSubscribedEvent, raw);
          await dispatchEvent(env, config, webhooks, logger);
        } catch (err) {
          ctx.logger.error(`[discord-transparency] handler error for ${eventName}`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });
    }

    // Bridge activity_log writes (synthetic events) into the same dispatcher.
    // Subscribes to the host's `activity.logged` plugin event — see poller.ts
    // for the design notes on why this is push-driven rather than poll-driven.
    await startPoller(
      ctx as unknown as PollerContext,
      async (env) => {
        await dispatchEvent(env, config, webhooks, logger);
      },
      { hostUrl: process.env.PAPERCLIP_PUBLIC_URL }
    );
  },

  async onValidateConfig(rawConfig) {
    try {
      resolveConfig(rawConfig);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  },

  async onHealth() {
    return { status: "ok" };
  },
});

export default plugin;

// Only call runWorker when this file is the main module so tests / scripts can
// import it without spawning the RPC host.
runWorker(plugin, import.meta.url);

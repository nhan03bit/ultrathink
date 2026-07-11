// intent: smoke test that builds an embed for a synthetic event, posts it to
//   DISCORD_WEBHOOK_FEED if set, otherwise prints the payload as JSON.
// status: done
// next: extend to fire one example for every supported event type
// confidence: high

import { resolveConfig } from "../src/config.js";
import { buildEmbed, type EventEnvelope } from "../src/embed-builder.js";
import { routeEvent } from "../src/event-router.js";
import { WebhookClient } from "../src/webhook-client.js";

async function main() {
  const config = resolveConfig({});
  const env: EventEnvelope = {
    name: "issue.created",
    occurredAt: new Date().toISOString(),
    entityId: "iss_test_001",
    entityType: "issue",
    payload: {
      identifier: "PAP-001",
      title: "Test event from discord-transparency plugin",
      priority: "high",
      assigneeName: "Mira [Code Integrator]",
    },
    actor: { type: "agent", name: "Steven", title: "CEO" },
    hostUrl: process.env.PAPERCLIP_PUBLIC_URL,
  };

  const decision = routeEvent(env, {
    minRunCostUsd: config.minRunCostUsd,
    directorMention: config.directorMention,
  });
  const embed = buildEmbed(env, { alertMention: decision.alertMention });
  if (!embed) {
    console.log("[test-emit] event suppressed by builder");
    return;
  }

  const logger = {
    info: (msg: string, meta?: Record<string, unknown>) => console.log(msg, meta ?? ""),
    warn: (msg: string, meta?: Record<string, unknown>) => console.warn(msg, meta ?? ""),
    error: (msg: string, meta?: Record<string, unknown>) => console.error(msg, meta ?? ""),
  };

  const webhooks = new WebhookClient({ webhooks: config.webhooks, logger });

  if (decision.suppress || decision.channels.length === 0) {
    console.log("[test-emit] router suppressed event:", env.name);
    return;
  }

  console.log("[test-emit] routing decision:", decision);
  console.log("[test-emit] embed payload:");
  console.log(JSON.stringify({ embeds: [embed] }, null, 2));

  for (const channel of decision.channels) {
    const result = await webhooks.post(channel, [embed]);
    console.log(`[test-emit] #${channel} →`, result);
  }
}

main().catch((err) => {
  console.error("[test-emit] failed:", err);
  process.exit(1);
});

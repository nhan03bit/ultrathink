// intent: decide which channels a given event fans out to, given its name +
//   actor classification + trigger type. Returns the set of channel keys to
//   post to, plus an optional alert mention to inject for #alerts embeds.
// status: done (matches the routing table in the prompt)
// next: drive routing rules from a config table once we ship more events
// confidence: high

import { classifyActor, type ActorLike, type ActorKind } from "./format-actor.js";
import type { ChannelKey } from "./config.js";
import type { EventEnvelope } from "./embed-builder.js";

/** Whether the event is high-cost enough to surface to #feed. */
function runIsExpensive(env: EventEnvelope, minCostUsd: number): boolean {
  const payload = env.payload ?? {};
  const cost = payload["costUsd"] ?? payload["cost"] ?? payload["totalCostUsd"];
  if (typeof cost !== "number") return false;
  return cost >= minCostUsd;
}

export type RoutingDecision = {
  channels: ChannelKey[];
  /** When set, the embed builder gets a Discord mention to inject. */
  alertMention?: string;
  /** When true, the router has decided to drop the event. */
  suppress?: boolean;
};

export type RoutingOptions = {
  minRunCostUsd: number;
  /** Raw mention target — e.g. "123" (user) or "&987" (role). */
  directorMention: string;
};

function formatMention(target: string): string | undefined {
  const t = target.trim();
  if (!t) return undefined;
  // Role syntax: prefixed with `&`. User otherwise.
  if (t.startsWith("&")) return `<@${t}>`;
  return `<@${t}>`;
}

/**
 * Add #agents / #humans / #human→agent routing based on actor type.
 */
function fanOutByActor(env: EventEnvelope, base: ChannelKey[]): ChannelKey[] {
  const out = new Set<ChannelKey>(base);
  const kind: ActorKind = classifyActor(env.actor as ActorLike | null);
  if (kind === "agent") out.add("agents");
  if (kind === "human") out.add("humans");
  if (env.triggerType === "human_mention" || env.triggerType === "human_to_agent") {
    out.add("humanAgent");
  }
  return [...out];
}

export function routeEvent(env: EventEnvelope, opts: RoutingOptions): RoutingDecision {
  const directorMention = formatMention(opts.directorMention);

  switch (env.name) {
    case "issue.created":
      return { channels: fanOutByActor(env, ["feed"]) };

    case "issue.completed":
      return { channels: fanOutByActor(env, ["feed"]) };

    case "issue.blocked":
      return {
        channels: fanOutByActor(env, ["alerts"]),
        alertMention: directorMention,
      };

    case "document.created":
      return { channels: fanOutByActor(env, ["designDocs"]) };

    case "document.reviewed":
    case "document.approved":
      return { channels: fanOutByActor(env, ["designDocs"]) };

    case "agent.run.finished":
    case "heartbeat_run.completed": {
      if (!runIsExpensive(env, opts.minRunCostUsd)) return { channels: [], suppress: true };
      return { channels: fanOutByActor(env, ["feed"]) };
    }

    case "agent.error":
    case "agent.run.failed":
      return {
        channels: fanOutByActor(env, ["alerts"]),
        alertMention: directorMention,
      };

    case "budget.threshold":
    case "cost_event.created":
      return {
        channels: fanOutByActor(env, ["alerts"]),
        alertMention: directorMention,
      };

    default:
      // Unknown event types fall through to #feed by default. The follow-up
      // subagent can add explicit handlers.
      return { channels: fanOutByActor(env, ["feed"]) };
  }
}

/**
 * Live event-bus subscriptions. These names MUST match the SDK's
 * `PluginEventName` union. Synthetic names (e.g. `issue.completed`,
 * `document.*`, `agent.error`) are routed by name internally but are wired
 * via `activity_log` polling in the follow-up subagent — the live bus does
 * not emit them.
 */
export const LIVE_SUBSCRIBED_EVENTS = [
  "issue.created",
  "issue.updated",
  "issue.comment.created",
  "agent.run.started",
  "agent.run.finished",
  "agent.run.failed",
  "agent.run.cancelled",
  "cost_event.created",
  "approval.created",
  "approval.decided",
] as const;
export type LiveSubscribedEvent = (typeof LIVE_SUBSCRIBED_EVENTS)[number];

/**
 * Synthetic event names recognized by the router/builder but NOT subscribed
 * on the live bus. The follow-up subagent will translate `activity_log`
 * rows or aggregated state changes into these names before invoking
 * `dispatchEvent`.
 */
export const SYNTHETIC_EVENTS = [
  "issue.completed",
  "issue.blocked",
  "document.created",
  "document.reviewed",
  "document.approved",
  "agent.error",
  "heartbeat_run.completed",
  "budget.threshold",
] as const;
export type SyntheticEvent = (typeof SYNTHETIC_EVENTS)[number];

export type SubscribedEvent = LiveSubscribedEvent | SyntheticEvent;

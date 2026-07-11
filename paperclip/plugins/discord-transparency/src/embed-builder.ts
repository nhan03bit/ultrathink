// intent: pure functions that turn a Paperclip event payload into one or more
//   Discord embed objects. Stays I/O-free so it's trivial to unit test.
// status: partially_done — implements the core mappings called out in the
//   plan (issue.*, document.*, agent.run.*, agent.error, cost/budget). A
//   follow-up subagent will fill in the long tail (approvals, comments,
//   workspace events, plugin-specific events).
// next: extract per-event helpers if this file grows past ~400 lines
// confidence: medium

import { formatActor, type ActorLike } from "./format-actor.js";

/* -------------------------------------------------------------------- */
/* Discord embed primitives                                              */
/* -------------------------------------------------------------------- */

export type DiscordEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

export type DiscordEmbed = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  footer?: { text: string };
  timestamp?: string;
  author?: { name: string; icon_url?: string };
};

export type DiscordWebhookPayload = {
  content?: string;
  embeds: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
};

export const COLORS = {
  gray: 0x6b7280,
  green: 0x10b981,
  amber: 0xf59e0b,
  red: 0xef4444,
  blue: 0x3b82f6,
  violet: 0x8b5cf6,
} as const;

/* -------------------------------------------------------------------- */
/* Loose event payload — Paperclip's exact shape isn't fully typed in    */
/* the SDK exports we have available, so we accept a permissive shape    */
/* and pull what we need. The follow-up subagent can tighten this.       */
/* -------------------------------------------------------------------- */

export type EventEnvelope = {
  /** Event name, e.g. "issue.created", "agent.run.finished". */
  name: string;
  /** Stable id of the event, when the host emits one. */
  id?: string;
  /** ISO timestamp the event occurred at. */
  occurredAt?: string;
  /** Active company. */
  companyId?: string;
  /** Project the event is scoped to, if any. */
  projectId?: string;
  /** Primary entity the event is about. */
  entityId?: string;
  entityType?: string;
  /** Whatever the host puts in the "data" payload. */
  payload?: Record<string, unknown>;
  /** Best-effort actor extracted by the router. */
  actor?: ActorLike | null;
  /** Best-effort trigger type — used to detect human→agent mentions. */
  triggerType?: string | null;
  /** Optional hostname so embeds can deep-link back into Paperclip. */
  hostUrl?: string;
};

/* -------------------------------------------------------------------- */
/* Helpers                                                               */
/* -------------------------------------------------------------------- */

function safe(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  return s.length ? s : fallback;
}

function pickString(payload: Record<string, unknown> | undefined, ...keys: string[]): string | undefined {
  if (!payload) return undefined;
  for (const k of keys) {
    const v = payload[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}

function pickNumber(payload: Record<string, unknown> | undefined, ...keys: string[]): number | undefined {
  if (!payload) return undefined;
  for (const k of keys) {
    const v = payload[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

function actorAsAuthor(actor: ActorLike | null | undefined) {
  return actor ? { name: formatActor(actor) } : undefined;
}

function buildIssueUrl(env: EventEnvelope): string | undefined {
  if (!env.hostUrl) return undefined;
  const id = env.entityId ?? pickString(env.payload, "id", "issueId");
  if (!id) return undefined;
  return `${env.hostUrl.replace(/\/$/, "")}/issues/${id}`;
}

function buildDocUrl(env: EventEnvelope): string | undefined {
  if (!env.hostUrl) return undefined;
  const id = pickString(env.payload, "documentId", "docId", "id") ?? env.entityId;
  if (!id) return undefined;
  return `${env.hostUrl.replace(/\/$/, "")}/design-docs/${id}`;
}

/* -------------------------------------------------------------------- */
/* Per-event builders                                                    */
/* -------------------------------------------------------------------- */

function buildIssueCreated(env: EventEnvelope): DiscordEmbed {
  const title = pickString(env.payload, "title") ?? "Issue created";
  const identifier = pickString(env.payload, "identifier") ?? env.entityId;
  return {
    title: `Issue created — ${safe(identifier)}`,
    description: title,
    url: buildIssueUrl(env),
    color: COLORS.gray,
    author: actorAsAuthor(env.actor),
    fields: [
      {
        name: "Priority",
        value: safe(pickString(env.payload, "priority")),
        inline: true,
      },
      {
        name: "Assignee",
        value: safe(pickString(env.payload, "assigneeName")),
        inline: true,
      },
    ],
    timestamp: env.occurredAt,
    footer: { text: "Paperclip · issue.created" },
  };
}

function buildIssueCompleted(env: EventEnvelope): DiscordEmbed {
  const title = pickString(env.payload, "title") ?? "Issue completed";
  const identifier = pickString(env.payload, "identifier") ?? env.entityId;
  return {
    title: `Issue completed — ${safe(identifier)}`,
    description: title,
    url: buildIssueUrl(env),
    color: COLORS.green,
    author: actorAsAuthor(env.actor),
    timestamp: env.occurredAt,
    footer: { text: "Paperclip · issue.completed" },
  };
}

function buildIssueBlocked(env: EventEnvelope, mention?: string): DiscordEmbed {
  const title = pickString(env.payload, "title") ?? "Issue blocked";
  const identifier = pickString(env.payload, "identifier") ?? env.entityId;
  const reason = pickString(env.payload, "reason", "blockerReason") ?? "No reason provided.";
  return {
    title: `Issue blocked — ${safe(identifier)}`,
    description: `${title}\n\n${reason}${mention ? `\n\n${mention}` : ""}`,
    url: buildIssueUrl(env),
    color: COLORS.amber,
    author: actorAsAuthor(env.actor),
    timestamp: env.occurredAt,
    footer: { text: "Paperclip · issue.blocked" },
  };
}

function buildDocumentCreated(env: EventEnvelope): DiscordEmbed {
  const title = pickString(env.payload, "title") ?? "Design doc created";
  return {
    title: `Design doc — ${title}`,
    description: pickString(env.payload, "summary", "description"),
    url: buildDocUrl(env),
    color: COLORS.blue,
    author: actorAsAuthor(env.actor),
    timestamp: env.occurredAt,
    footer: { text: "Paperclip · document.created" },
  };
}

function buildDocumentReviewed(env: EventEnvelope): DiscordEmbed {
  const decision = pickString(env.payload, "decision", "verdict")?.toLowerCase() ?? "review";
  const color =
    decision === "approve" ? COLORS.green : decision === "block" || decision === "reject" ? COLORS.red : COLORS.amber;
  const title = pickString(env.payload, "title") ?? "Design doc reviewed";
  return {
    title: `Doc review (${decision}) — ${title}`,
    description: pickString(env.payload, "comment", "summary"),
    url: buildDocUrl(env),
    color,
    author: actorAsAuthor(env.actor),
    timestamp: env.occurredAt,
    footer: { text: "Paperclip · document.reviewed" },
  };
}

function buildDocumentApproved(env: EventEnvelope): DiscordEmbed {
  const title = pickString(env.payload, "title") ?? "Design doc approved";
  return {
    title: `Doc approved — ${title}`,
    description: pickString(env.payload, "summary"),
    url: buildDocUrl(env),
    color: COLORS.green,
    author: actorAsAuthor(env.actor),
    timestamp: env.occurredAt,
    footer: { text: "Paperclip · document.approved" },
  };
}

function buildAgentRunFinished(env: EventEnvelope): DiscordEmbed {
  const cost = pickNumber(env.payload, "costUsd", "cost", "totalCostUsd") ?? 0;
  const tokens = pickNumber(env.payload, "tokens", "totalTokens");
  const durationMs = pickNumber(env.payload, "durationMs", "elapsedMs");
  return {
    title: "Heartbeat run completed",
    description: pickString(env.payload, "summary"),
    color: COLORS.gray,
    author: actorAsAuthor(env.actor),
    fields: [
      { name: "Cost", value: `$${cost.toFixed(2)}`, inline: true },
      {
        name: "Tokens",
        value: tokens ? tokens.toLocaleString() : "—",
        inline: true,
      },
      {
        name: "Duration",
        value: durationMs ? `${(durationMs / 1000).toFixed(1)}s` : "—",
        inline: true,
      },
    ],
    timestamp: env.occurredAt,
    footer: { text: "Paperclip · agent.run.finished" },
  };
}

function buildAgentError(env: EventEnvelope, mention?: string): DiscordEmbed {
  const message = pickString(env.payload, "error", "message") ?? "Unknown agent error";
  return {
    title: "Agent error",
    description: `${message}${mention ? `\n\n${mention}` : ""}`,
    color: COLORS.red,
    author: actorAsAuthor(env.actor),
    timestamp: env.occurredAt,
    footer: { text: `Paperclip · ${env.name}` },
  };
}

function buildBudgetThreshold(env: EventEnvelope, mention?: string): DiscordEmbed {
  const pct = pickNumber(env.payload, "percent", "thresholdPercent");
  const spent = pickNumber(env.payload, "spentUsd", "spent");
  const limit = pickNumber(env.payload, "limitUsd", "limit");
  return {
    title: "Budget threshold reached",
    description:
      pickString(env.payload, "summary") ??
      `Budget at ${pct ? `${pct.toFixed(0)}%` : "?%"} (${spent != null ? `$${spent.toFixed(2)}` : "?"}/${limit != null ? `$${limit.toFixed(2)}` : "?"}).` +
        (mention ? `\n\n${mention}` : ""),
    color: COLORS.amber,
    author: actorAsAuthor(env.actor),
    timestamp: env.occurredAt,
    footer: { text: "Paperclip · budget.threshold" },
  };
}

function buildGeneric(env: EventEnvelope): DiscordEmbed {
  return {
    title: env.name,
    description: pickString(env.payload, "summary", "title", "message"),
    color: COLORS.gray,
    author: actorAsAuthor(env.actor),
    timestamp: env.occurredAt,
    footer: { text: `Paperclip · ${env.name}` },
  };
}

/* -------------------------------------------------------------------- */
/* Public entry point                                                    */
/* -------------------------------------------------------------------- */

export type BuildEmbedOptions = {
  /** Mention string injected into alert embeds (e.g. "<@123>" or "<@&987>"). */
  alertMention?: string;
};

/**
 * Map a single event to a Discord embed. Returns `null` to suppress.
 */
export function buildEmbed(env: EventEnvelope, opts: BuildEmbedOptions = {}): DiscordEmbed | null {
  switch (env.name) {
    case "issue.created":
      return buildIssueCreated(env);
    case "issue.completed":
      return buildIssueCompleted(env);
    case "issue.blocked":
      return buildIssueBlocked(env, opts.alertMention);
    case "document.created":
      return buildDocumentCreated(env);
    case "document.reviewed":
      return buildDocumentReviewed(env);
    case "document.approved":
      return buildDocumentApproved(env);
    case "agent.run.finished":
    case "heartbeat_run.completed":
      return buildAgentRunFinished(env);
    case "agent.error":
    case "agent.run.failed":
      return buildAgentError(env, opts.alertMention);
    case "budget.threshold":
    case "cost_event.created":
      return buildBudgetThreshold(env, opts.alertMention);
    default:
      return buildGeneric(env);
  }
}

// intent: messageReactionAdd handler for two reaction-driven flows:
//   1. Doc-review lane votes — emoji on an embed with a footerCustomId encoding
//      doc=<id>|rev=<id>|num=<n>|issue=<id>. Calls the doc-review approval
//      endpoint. API-level idempotency on (reviewer_agent_id, lane, revisionId)
//      deduplicates races. A 5s in-memory window provides best-effort local dedup.
//   2. Run-cancel shortcut — 🚫 on a "run started" notification embed triggers
//      a cancel call to Paperclip.
//   Requires: Partials.Message, Partials.Reaction, Partials.User (doc rev 2 / Mira C2).
// status: done
// confidence: high

import type { MessageReaction, PartialMessageReaction, User, PartialUser } from "discord.js";
import { cancelRun } from "./paperclip-client.js";
import { resolveIdentity } from "./identity.js";
import type { BotContext } from "./bot-context.js";

// Best-effort local dedup — the durable guard is the API-level idempotency key.
const recentReactions = new Map<string, number>();
const LOCAL_DEDUP_MS = 5000;

function isRecentDup(key: string): boolean {
  const last = recentReactions.get(key);
  if (last && Date.now() - last < LOCAL_DEDUP_MS) return true;
  recentReactions.set(key, Date.now());
  return false;
}

// footerCustomId encoding: doc=<docId>|rev=<revId>|num=<n>|issue=<issueId>
function parseFooterCustomId(footerText: string): Record<string, string> | null {
  const parts: Record<string, string> = {};
  for (const seg of footerText.split("|")) {
    const eq = seg.indexOf("=");
    if (eq < 0) continue;
    parts[seg.slice(0, eq)] = seg.slice(eq + 1);
  }
  return Object.keys(parts).length > 0 ? parts : null;
}

const EMOJI_TO_LANE: Record<string, string> = {
  "✅": "approve",
  "❌": "block",
  "🔄": "changes_requested",
};

export async function handleReaction(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  ctx: BotContext
): Promise<void> {
  if (user.bot) return;

  // Fetch partial data if needed.
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch {
      return;
    }
  }
  if (reaction.message.partial) {
    try {
      await reaction.message.fetch();
    } catch {
      return;
    }
  }

  const emoji = reaction.emoji.name ?? "";
  const message = reaction.message;

  // --- Run-cancel shortcut ---
  if (emoji === "🚫") {
    const identity = await resolveIdentity(user.id, ctx.env.UT_BRIDGE_URL).catch(() => null);
    if (!identity) return;

    // Embed description or footer may encode the run ID.
    const embeds = message.embeds ?? [];
    for (const embed of embeds) {
      const footer = embed.footer?.text ?? "";
      const runMatch = /run=([0-9a-f-]{36})/i.exec(footer) ?? /run=([0-9a-f-]{36})/i.exec(embed.description ?? "");
      if (runMatch) {
        const dedupKey = `cancel:${runMatch[1]}:${user.id}`;
        if (isRecentDup(dedupKey)) return;
        await cancelRun(ctx.paperclip, runMatch[1]).catch((e) =>
          console.warn("[reactions] cancel run failed:", e?.message ?? e)
        );
        return;
      }
    }
    return;
  }

  // --- Doc-review lane vote ---
  const lane = EMOJI_TO_LANE[emoji];
  if (!lane) return;

  const embeds = message.embeds ?? [];
  for (const embed of embeds) {
    const footer = embed.footer?.text ?? "";
    const parsed = parseFooterCustomId(footer);
    if (!parsed?.doc || !parsed?.rev) continue;

    const { doc: docId, rev: revId, issue: issueId } = parsed;
    const identity = await resolveIdentity(user.id, ctx.env.UT_BRIDGE_URL).catch(() => null);
    if (!identity?.paperclipUserId) continue;

    const dedupKey = `docreview:${identity.paperclipUserId}:${lane}:${revId}`;
    if (isRecentDup(dedupKey)) return;

    // Idempotency is enforced at the API level — we pass the unique key.
    const body = {
      reviewerUserId: identity.paperclipUserId,
      lane,
      verdict: lane,
      docId,
      revisionId: revId,
      issueId: issueId ?? null,
    };

    await fetch(
      `${ctx.env.PAPERCLIP_API_URL}/api/issues/${encodeURIComponent(issueId ?? docId)}/documents/design-doc/reviews`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ctx.env.PAPERCLIP_API_KEY}`,
        },
        body: JSON.stringify(body),
      }
    ).catch((e) => console.warn("[reactions] doc-review vote failed:", e?.message ?? e));
  }
}

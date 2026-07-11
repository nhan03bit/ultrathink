// intent: messageCreate handler for bot @-mentions. Parses the message for an
//   issue identifier (e.g. INU-41) and replies with the issue status embed.
//   Also records the Discord thread → issue mapping in discord_issue_threads
//   via threads-store so reaction handlers can resolve back to the issue later.
//   Step 7 + 8 of the doc-verification table.
// status: done
// confidence: high

import type { Message, Client } from "discord.js";
import { getIssue } from "./paperclip-client.js";
import { buildEmbed } from "./embeds.js";
import { upsertThread } from "./threads-store.js";
import { resolveIdentity } from "./identity.js";
import type { BotContext } from "./bot-context.js";

// Match any word-prefixed all-caps identifier like INU-41, PAP-123.
const ISSUE_ID_RE = /\b([A-Z]{2,8}-\d+)\b/;

export async function handleMention(message: Message, client: Client, ctx: BotContext): Promise<void> {
  if (!message.mentions.has(client.user!)) return;

  const match = ISSUE_ID_RE.exec(message.content);
  if (!match) {
    await message.reply("Mention me with an issue identifier (e.g. `INU-41`) to look it up.");
    return;
  }

  const issueId = match[1]!;
  const issue = await getIssue(ctx.paperclip, issueId);
  if (!issue) {
    await message.reply(`Issue \`${issueId}\` not found.`);
    return;
  }

  // Resolve mention author identity for embed actorName.
  const identity = await resolveIdentity(message.author.id, ctx.env.UT_BRIDGE_URL).catch(() => null);
  const actorName = identity?.name ?? message.author.username;

  const { embed, content } = buildEmbed({
    actorName,
    nextStep: "—",
    title: `${issue.identifier}: ${issue.title}`,
    description: `Status: **${issue.status}** · Priority: ${issue.priority ?? "none"}`,
  });

  const reply = await message.reply({ content, embeds: [embed] });

  // Record thread → issue mapping if this message is inside a thread.
  if (message.channel.isThread()) {
    await upsertThread(
      {
        threadId: message.channel.id,
        issueId: issue.id,
        channelId: message.channel.parentId ?? message.channel.id,
        createdByHumanId: identity?.humanId ?? null,
      },
      ctx.env.UT_BRIDGE_URL
    ).catch((e) => console.warn("[mentions] thread upsert failed:", e?.message ?? e));
  }

  void reply; // suppress unused warning; reply already sent
}

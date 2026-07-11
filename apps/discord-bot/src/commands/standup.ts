// intent: /standup — post a non-ephemeral summary of active agents and recent
//   activity to the channel. Non-ephemeral so the whole team sees it.
//   Calls GET /api/companies/:id/dashboard for a compact overview.
// status: done
// confidence: high

import type { ChatInputCommandInteraction } from "discord.js";
import { buildEmbed } from "../embeds.js";
import type { BotContext } from "../bot-context.js";
import type { HumanIdentity } from "../identity.js";
import type { SlashCommandDef } from "../register-commands.js";

export const definition: SlashCommandDef = {
  name: "standup",
  description: "Post a team standup summary to the channel",
};

export async function handle(
  interaction: ChatInputCommandInteraction,
  identity: HumanIdentity | null,
  ctx: BotContext
): Promise<void> {
  await interaction.deferReply();

  let summaryLines: string[] = [];
  try {
    const res = await fetch(
      `${ctx.env.PAPERCLIP_API_URL}/api/companies/${encodeURIComponent(ctx.env.PAPERCLIP_COMPANY_ID)}/dashboard`,
      { headers: { Authorization: `Bearer ${ctx.env.PAPERCLIP_API_KEY}` } }
    );
    if (res.ok) {
      const data = (await res.json()) as {
        activeAgents?: number;
        openIssues?: number;
        inProgressIssues?: number;
      };
      summaryLines = [
        `Active agents: **${data.activeAgents ?? "?"}**`,
        `Issues in progress: **${data.inProgressIssues ?? "?"}**`,
        `Open issues: **${data.openIssues ?? "?"}**`,
      ];
    }
  } catch {
    summaryLines = ["_(dashboard unavailable)_"];
  }

  const actorName = identity?.name ?? interaction.user.username;
  const { embed, content } = buildEmbed({
    actorName,
    nextStep: "—",
    title: "Team Standup",
    description: summaryLines.join("\n"),
    timestampUnix: Math.floor(Date.now() / 1000),
  });

  await interaction.editReply({ content, embeds: [embed] });
}

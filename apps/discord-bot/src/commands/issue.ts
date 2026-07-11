// intent: /issue status:<identifier> — look up a Paperclip issue and show its
//   current state in a non-ephemeral embed. Non-ephemeral so the whole channel
//   can see the status at a glance (doc rev 2 step 6).
// status: done
// confidence: high

import type { ChatInputCommandInteraction } from "discord.js";
import { getIssue } from "../paperclip-client.js";
import { buildEmbed } from "../embeds.js";
import { OPTION_STRING } from "../discord-constants.js";
import type { BotContext } from "../bot-context.js";
import type { HumanIdentity } from "../identity.js";
import type { SlashCommandDef } from "../register-commands.js";

export const definition: SlashCommandDef = {
  name: "issue",
  description: "Show the status of a Paperclip issue",
  options: [
    {
      type: OPTION_STRING,
      name: "id",
      description: "Issue identifier (e.g. INU-41) or UUID",
      required: true,
    },
  ],
};

export async function handle(
  interaction: ChatInputCommandInteraction,
  _identity: HumanIdentity | null,
  ctx: BotContext
): Promise<void> {
  const issueId = interaction.options.getString("id", true).trim();
  await interaction.deferReply();

  const issue = await getIssue(ctx.paperclip, issueId);
  if (!issue) {
    await interaction.editReply({ content: `Issue \`${issueId}\` not found.` });
    return;
  }

  const { embed, content } = buildEmbed({
    actorName: interaction.user.username,
    nextStep: "—",
    title: `${issue.identifier}: ${issue.title}`,
    description: `Status: **${issue.status}** · Priority: ${issue.priority ?? "none"}`,
  });

  await interaction.editReply({ content, embeds: [embed] });
}

// intent: /cancel run:<run-id> — cancel a live Paperclip run. Ephemeral reply.
//   Requires the invoker to be a mapped human (unmapped → standard 404 reply).
// status: done
// confidence: high

import type { ChatInputCommandInteraction } from "discord.js";
import { cancelRun } from "../paperclip-client.js";
import { buildEmbed } from "../embeds.js";
import { OPTION_STRING, EPHEMERAL } from "../discord-constants.js";
import type { BotContext } from "../bot-context.js";
import type { HumanIdentity } from "../identity.js";
import type { SlashCommandDef } from "../register-commands.js";

export const definition: SlashCommandDef = {
  name: "cancel",
  description: "Cancel a live agent run",
  options: [
    {
      type: OPTION_STRING,
      name: "run",
      description: "Run ID (UUID)",
      required: true,
    },
  ],
};

export async function handle(
  interaction: ChatInputCommandInteraction,
  identity: HumanIdentity | null,
  ctx: BotContext
): Promise<void> {
  if (!identity) {
    await interaction.reply({
      content: "You are not registered as a human in this workspace.",
      flags: EPHEMERAL,
    });
    return;
  }

  const runId = interaction.options.getString("run", true).trim();
  await interaction.deferReply({ flags: EPHEMERAL });

  try {
    await cancelRun(ctx.paperclip, runId);
  } catch (e: any) {
    await interaction.editReply({ content: `Failed to cancel run \`${runId}\`: ${e?.message ?? e}` });
    return;
  }

  const { embed, content } = buildEmbed({
    actorName: identity.name,
    nextStep: "—",
    title: `Run \`${runId.slice(0, 8)}\` cancelled`,
    description: `Cancelled by ${identity.name} via Discord.`,
  });

  await interaction.editReply({ content, embeds: [embed] });
}

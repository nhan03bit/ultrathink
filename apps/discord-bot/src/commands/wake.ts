// intent: /wake agent:<id-or-slug> reason:<text> — on-demand wakeup. Calls
//   POST /api/agents/{agentId}/wakeup with source:"on_demand". The response is
//   ephemeral so only the invoker sees it (doc rev 2 step 6).
//   Requires the invoker to be a mapped human (identity must be non-null);
//   unmapped Discord users receive the standard unmapped reply.
// status: done
// confidence: high

import type { ChatInputCommandInteraction } from "discord.js";
import { buildEmbed } from "../embeds.js";
import { OPTION_STRING, EPHEMERAL } from "../discord-constants.js";
import type { BotContext } from "../bot-context.js";
import type { HumanIdentity } from "../identity.js";
import type { SlashCommandDef } from "../register-commands.js";

export const definition: SlashCommandDef = {
  name: "wake",
  description: "Wake an agent on demand",
  options: [
    {
      type: OPTION_STRING,
      name: "agent",
      description: "Agent ID or slug",
      required: true,
    },
    {
      type: OPTION_STRING,
      name: "reason",
      description: "Why are you waking this agent?",
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
      content: "You are not registered as a human in this workspace. Ask an admin to add your Discord account.",
      flags: EPHEMERAL,
    });
    return;
  }

  const agentId = interaction.options.getString("agent", true).trim();
  const reason = interaction.options.getString("reason", true).trim();
  await interaction.deferReply({ flags: EPHEMERAL });

  const res = await fetch(`${ctx.env.PAPERCLIP_API_URL}/api/agents/${encodeURIComponent(agentId)}/wakeup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.env.PAPERCLIP_API_KEY}`,
    },
    body: JSON.stringify({
      source: "on_demand",
      triggerDetail: `Discord /wake by ${identity.name}`,
      reason,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    await interaction.editReply({
      content: `Failed to wake agent \`${agentId}\` (${res.status}): ${text.slice(0, 200)}`,
    });
    return;
  }

  const { embed, content } = buildEmbed({
    actorName: identity.name,
    nextStep: "Await agent response",
    title: `Woke agent \`${agentId}\``,
    description: `Reason: ${reason}`,
  });

  await interaction.editReply({ content, embeds: [embed] });
}

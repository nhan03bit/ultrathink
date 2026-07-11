// intent: /freeze and /unfreeze — company-level agent pause/resume. Co-located
//   per doc rev 2. Both are ephemeral (only invoker sees the confirmation).
//   Requires mapped human; unmapped → standard reply.
// status: done
// confidence: high

import type { ChatInputCommandInteraction } from "discord.js";
import { freezeCompany, unfreezeCompany } from "../paperclip-client.js";
import { EPHEMERAL } from "../discord-constants.js";
import { buildEmbed } from "../embeds.js";
import type { BotContext } from "../bot-context.js";
import type { HumanIdentity } from "../identity.js";
import type { SlashCommandDef } from "../register-commands.js";

export const freezeDefinition: SlashCommandDef = {
  name: "freeze",
  description: "Pause all agent activity for this company",
};

export const unfreezeDefinition: SlashCommandDef = {
  name: "unfreeze",
  description: "Resume agent activity for this company",
};

async function handleOp(
  interaction: ChatInputCommandInteraction,
  identity: HumanIdentity | null,
  ctx: BotContext,
  op: "freeze" | "unfreeze"
): Promise<void> {
  if (!identity) {
    await interaction.reply({
      content: "You are not registered as a human in this workspace.",
      flags: EPHEMERAL,
    });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL });

  try {
    if (op === "freeze") {
      await freezeCompany(ctx.paperclip);
    } else {
      await unfreezeCompany(ctx.paperclip);
    }
  } catch (e: any) {
    await interaction.editReply({ content: `Failed to ${op} company: ${e?.message ?? e}` });
    return;
  }

  const label = op === "freeze" ? "Frozen" : "Unfrozen";
  const nextStep = op === "freeze" ? "Run /unfreeze to resume" : "Agents will resume on next heartbeat";

  const { embed, content } = buildEmbed({
    actorName: identity.name,
    nextStep,
    title: `Company ${label}`,
    description: `All agent activity ${op === "freeze" ? "paused" : "resumed"} by ${identity.name}.`,
  });

  await interaction.editReply({ content, embeds: [embed] });
}

export async function handleFreeze(
  interaction: ChatInputCommandInteraction,
  identity: HumanIdentity | null,
  ctx: BotContext
): Promise<void> {
  return handleOp(interaction, identity, ctx, "freeze");
}

export async function handleUnfreeze(
  interaction: ChatInputCommandInteraction,
  identity: HumanIdentity | null,
  ctx: BotContext
): Promise<void> {
  return handleOp(interaction, identity, ctx, "unfreeze");
}

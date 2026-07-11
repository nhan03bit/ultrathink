// intent: /budget — show current company spend vs budget cap. Ephemeral reply
//   (only invoker sees it). Requires mapped human for meaningful context but
//   falls back gracefully for unmapped users.
// status: done
// confidence: high

import type { ChatInputCommandInteraction } from "discord.js";
import { companySpend } from "../paperclip-client.js";
import { EPHEMERAL } from "../discord-constants.js";
import { buildEmbed } from "../embeds.js";
import type { BotContext } from "../bot-context.js";
import type { HumanIdentity } from "../identity.js";
import type { SlashCommandDef } from "../register-commands.js";

export const definition: SlashCommandDef = {
  name: "budget",
  description: "Show current company spend vs monthly budget",
};

function centsToUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function handle(
  interaction: ChatInputCommandInteraction,
  identity: HumanIdentity | null,
  ctx: BotContext
): Promise<void> {
  await interaction.deferReply({ flags: EPHEMERAL });

  let description: string;
  try {
    const spend = await companySpend(ctx.paperclip);
    const budgetStr = spend.budgetCents != null ? centsToUsd(spend.budgetCents) : "unlimited";
    const remainStr = spend.remainingCents != null ? centsToUsd(spend.remainingCents) : "N/A";
    description = [
      `Spent: **${centsToUsd(spend.spentCents)}**`,
      `Budget: **${budgetStr}**`,
      `Remaining: **${remainStr}**`,
    ].join("\n");
  } catch (e: any) {
    description = `_(spend data unavailable: ${e?.message ?? e})_`;
  }

  const actorName = identity?.name ?? interaction.user.username;
  const { embed, content } = buildEmbed({
    actorName,
    nextStep: "—",
    title: "Company Budget",
    description,
  });

  await interaction.editReply({ content, embeds: [embed] });
}

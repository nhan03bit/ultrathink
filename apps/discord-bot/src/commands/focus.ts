// intent: /focus duration:<minutes> — set or clear a human focus session in the
//   human_focus_state table via ut-bridge. Ephemeral reply. When duration=0 or
//   omitted, clears focus. Backed by migration 027 (human_focus_state).
//   Requires mapped human; unmapped → standard 404 reply.
// status: done
// confidence: high

import type { ChatInputCommandInteraction } from "discord.js";
import { buildEmbed } from "../embeds.js";
import { OPTION_INTEGER, EPHEMERAL } from "../discord-constants.js";
import type { BotContext } from "../bot-context.js";
import type { HumanIdentity } from "../identity.js";
import type { SlashCommandDef } from "../register-commands.js";

export const definition: SlashCommandDef = {
  name: "focus",
  description: "Set a focus session (0 or omit to clear)",
  options: [
    {
      type: OPTION_INTEGER,
      name: "duration",
      description: "Focus duration in minutes (0 to clear)",
      required: false,
      min_value: 0,
      max_value: 480,
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

  const duration = interaction.options.getInteger("duration") ?? 0;
  await interaction.deferReply({ flags: EPHEMERAL });

  const method = duration > 0 ? "PUT" : "DELETE";
  const url = `${ctx.env.UT_BRIDGE_URL}/humans/${encodeURIComponent(identity.humanId)}/focus`;
  const body = duration > 0 ? JSON.stringify({ durationMinutes: duration }) : undefined;

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      await interaction.editReply({ content: `Failed to update focus state (${res.status}): ${text.slice(0, 200)}` });
      return;
    }
  } catch (e: any) {
    await interaction.editReply({ content: `Failed to update focus state: ${e?.message ?? e}` });
    return;
  }

  const title = duration > 0 ? `Focus set for ${duration} min` : "Focus cleared";
  const nextStep = duration > 0 ? `Expires in ${duration} min` : "—";

  const { embed, content } = buildEmbed({
    actorName: identity.name,
    nextStep,
    title,
    timestampUnix: Math.floor(Date.now() / 1000),
  });

  await interaction.editReply({ content, embeds: [embed] });
}

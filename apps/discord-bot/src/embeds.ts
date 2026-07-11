// intent: typed embed-builder factory (doc rev 2 / Mira blocker, Quinn
//   blocker-2). Required `actorName` + `nextStep` enforced at the type level
//   AND at runtime via zod. Returns a serializable shape so this module is
//   testable without importing discord.js — the call site assembles a
//   `EmbedBuilder` from `embed` and passes `content` alongside as the
//   screen-reader fallback.
//
//   Doc rev 2 step 15:
//     (a) factory rejects construction without actorName/nextStep (type + runtime)
//     (b) emoji-stripped readability — title + description still convey
//         actor and action
//     (c) timestamps render as `<t:UNIX:R>` so Discord localizes them
//     (d) every embed has a non-empty `content` fallback string
// status: done for the embed shape; lane-specific helpers (doc-review embed,
//   run embed, mention-reply embed) compose this in follow-up heartbeats.
// confidence: high

import { z } from "zod";

// Variation-Selector + ZWJ-aware emoji strip. Covers BMP pictographs, the
// supplementary planes Discord uses for compound emoji, and presentation
// selectors. Keeps ASCII punctuation and letters intact.
// eslint-disable-next-line no-misleading-character-class
const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu;

export function stripEmoji(s: string): string {
  return s
    .replace(EMOJI_PATTERN, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const EmbedSpecSchema = z.object({
  actorName: z.string().min(1, "actorName is required"),
  nextStep: z.string().min(1, "nextStep is required"),
  title: z.string().min(1, "title is required"),
  description: z.string().optional(),
  url: z.string().url().optional(),
  color: z.number().int().nonnegative().optional(),
  // Discord renders <t:UNIX:R> as a relative localized timestamp ("3 minutes
  // ago" in the viewer's locale). Pass seconds-since-epoch.
  timestampUnix: z.number().int().nonnegative().optional(),
  // Custom-id payload encoded into the footer text — used by the reaction
  // handler to resolve target without a DB lookup. Must be a stable string.
  footerCustomId: z.string().optional(),
  fields: z
    .array(
      z.object({
        name: z.string().min(1),
        value: z.string().min(1),
        inline: z.boolean().optional(),
      })
    )
    .optional(),
});

export type EmbedSpec = z.infer<typeof EmbedSpecSchema>;

export interface EmbedJSON {
  title: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  footer: { text: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

export interface BuiltEmbed {
  embed: EmbedJSON;
  // Screen-reader fallback content. Always non-empty per doc 15(d).
  content: string;
  // Discord-formatted relative-time tag, or null if no timestamp was provided.
  timestampTag: string | null;
}

export function buildEmbed(spec: EmbedSpec): BuiltEmbed {
  const parsed = EmbedSpecSchema.parse(spec);

  const footerParts = [`by ${parsed.actorName}`, `next: ${parsed.nextStep}`];
  if (parsed.footerCustomId) footerParts.push(parsed.footerCustomId);
  const footerText = footerParts.join(" • ");

  const embed: EmbedJSON = {
    title: parsed.title,
    footer: { text: footerText },
  };
  if (parsed.description) embed.description = parsed.description;
  if (parsed.url) embed.url = parsed.url;
  if (parsed.color !== undefined) embed.color = parsed.color;
  if (parsed.fields && parsed.fields.length > 0) embed.fields = parsed.fields;
  if (parsed.timestampUnix !== undefined) {
    embed.timestamp = new Date(parsed.timestampUnix * 1000).toISOString();
  }

  const timestampTag = parsed.timestampUnix !== undefined ? `<t:${parsed.timestampUnix}:R>` : null;

  // Content fallback — emoji-stripped sentence that conveys actor + action
  // even if the embed is hidden by a screen reader.
  const fallbackParts = [
    stripEmoji(parsed.title),
    parsed.description ? stripEmoji(parsed.description) : null,
    `(${parsed.actorName} — ${parsed.nextStep})`,
    timestampTag,
  ].filter((p): p is string => Boolean(p));
  const content = fallbackParts.join(" — ").slice(0, 2000); // Discord content max

  return { embed, content, timestampTag };
}

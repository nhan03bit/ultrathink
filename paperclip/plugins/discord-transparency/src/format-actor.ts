// intent: server-side mirror of paperclip/ui/src/lib/format-actor.ts so that
//   embed payloads use the same bracket convention as the dashboard / UI.
// status: done
// next: keep in sync if the UI helper grows new actor variants
// confidence: high
//
// Convention:
//   - Agents render as `Name [Title]` (e.g. `Steven [CEO]`)
//   - Humans render as `Name`
//   - System actor renders as `system`
//   - Unknown / null actors render as `Unknown`
//
// Defensive: Paperclip's event payloads do not always set `actor.type`. If a
// `title` field is present we treat the entity as an agent (matches UI helper).

export type ActorLike = {
  type?: string | null;
  name?: string | null;
  title?: string | null;
};

export type ActorKind = "agent" | "human" | "system" | "unknown";

/**
 * Format an actor's display name with the bracket convention.
 */
export function formatActor(actor: ActorLike | null | undefined): string {
  if (!actor) return "Unknown";
  const name = (actor.name ?? "").trim();
  const title = (actor.title ?? "").trim();
  if (!name) return "Unknown";
  if (actor.type === "system" || name.toLowerCase() === "system") return "system";
  const isAgent = actor.type === "agent" || (!actor.type && Boolean(title));
  if (isAgent && title) return `${name} [${title}]`;
  return name;
}

/**
 * Best-effort classification of an actor for routing purposes.
 */
export function classifyActor(actor: ActorLike | null | undefined): ActorKind {
  if (!actor) return "unknown";
  if (actor.type === "agent") return "agent";
  if (actor.type === "human") return "human";
  if (actor.type === "system") return "system";
  // Fallback: title implies agent. Otherwise assume human.
  if ((actor.title ?? "").trim()) return "agent";
  if ((actor.name ?? "").trim().toLowerCase() === "system") return "system";
  if ((actor.name ?? "").trim()) return "human";
  return "unknown";
}

/**
 * Format an agent name + title pair when only the two strings are available.
 */
export function formatAgentName(name: string | null | undefined, title?: string | null): string {
  const safeName = (name ?? "").trim();
  const safeTitle = (title ?? "").trim();
  if (!safeName) return "Unknown";
  if (safeTitle) return `${safeName} [${safeTitle}]`;
  return safeName;
}

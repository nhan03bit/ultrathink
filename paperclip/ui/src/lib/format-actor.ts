// intent: single source of truth for actor formatting in the Paperclip UI
//   so agent renders match the dashboard / Discord bracket convention
//   (Steven [CEO], Mira [Code Integrator], Daniel)
// status: partially_done — wired into the timeline / activity actor renderers
//   (CommentThread.formatTimelineActorName, ActivityRow). Many components still
//   render `agent.name` directly; centralize via these helpers as we touch them.
// next: extend usage to AgentProperties, SidebarAgents, IssueChatThread,
//   ExecutionParticipantPicker, etc. — preferably one helper call per render.
// confidence: high
//
// Convention (mirrors dashboard/lib/actor.ts):
//   - Agents render as `Name [Title]` (e.g. `Steven [CEO]`)
//   - Humans render as `Name` (no brackets)
//   - System actor renders as the literal string `system`
//
// Defensive: Paperclip's API may not always set `actor.type`. If a `title`
// field is present we treat the entity as an agent.

export type AgentActor = {
  type: "agent";
  id: string;
  name: string;
  title: string;
};

export type HumanActor = {
  type: "human";
  id: string;
  name: string;
  discordUserId?: string;
};

export type SystemActor = {
  type: "system";
  name: "system";
};

export type Actor = AgentActor | HumanActor | SystemActor;

/**
 * Loose actor — the minimal shape we need to format. Any object with a name
 * and (optionally) a title or type. Everything else is ignored.
 */
export type ActorLike = {
  name?: string | null;
  title?: string | null;
  type?: string | null;
};

/**
 * Format an actor's display name with the bracket convention.
 *
 * - Agents (type === 'agent' OR a title is present) render as `Name [Title]`
 * - Everything else renders as `Name`
 */
export function formatActor(actor: ActorLike | null | undefined): string {
  if (!actor) return "Unknown";
  const name = (actor.name ?? "").trim();
  const title = (actor.title ?? "").trim();
  if (!name) return "Unknown";
  const isAgent = actor.type === "agent" || (!actor.type && Boolean(title));
  if (isAgent && title) {
    return `${name} [${title}]`;
  }
  return name;
}

/**
 * Format an agent name + title pair when you don't have a single Actor object.
 * Useful for callsites that hold the two fields separately (e.g. agentMap
 * lookups) and want the bracket convention without constructing an object.
 */
export function formatAgentName(name: string | null | undefined, title?: string | null): string {
  const safeName = (name ?? "").trim();
  const safeTitle = (title ?? "").trim();
  if (!safeName) return "Unknown";
  if (safeTitle) return `${safeName} [${safeTitle}]`;
  return safeName;
}

export function isAgent(actor: Actor): actor is AgentActor {
  return actor.type === "agent";
}

export function isHuman(actor: Actor): actor is HumanActor {
  return actor.type === "human";
}

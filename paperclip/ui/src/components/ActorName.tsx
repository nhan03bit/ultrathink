// intent: centralize the bracket-rendering convention (`Name [Title]` for agents,
//   `Name` for humans) into a single component. Wraps `formatActor()` from
//   `lib/format-actor.ts` and adds graceful null-handling for legacy call sites.
// status: done — single source of truth for actor name rendering across the UI.
// next: prefer this component over raw `agent.name` / `formatAgentName()` in new code.
// confidence: high
//
// Two prop shapes are accepted so existing call sites can adopt this without
// reshaping their data:
//   <ActorName actor={timelineActor} />          // preferred — full Actor-like shape
//   <ActorName agent={agent} />                  // legacy — for sites holding agent objects
//
// Both routes converge on `formatActor()`, so the rendered string matches the
// dashboard / Discord convention (e.g. `Steven [CEO]`, `Daniel`, `system`).

import { formatActor, type ActorLike } from "../lib/format-actor";

type ActorProp =
  | {
      name?: string | null;
      title?: string | null;
      type?: string | null;
    }
  | null
  | undefined;

type AgentProp =
  | {
      name?: string | null;
      title?: string | null;
    }
  | null
  | undefined;

type Props = {
  actor?: ActorProp;
  agent?: AgentProp;
  fallback?: string;
  className?: string;
};

export function ActorName({ actor, agent, fallback = "Unknown", className }: Props) {
  const source: ActorLike | null = actor
    ? { name: actor.name, title: actor.title, type: actor.type }
    : agent
      ? { name: agent.name, title: agent.title, type: "agent" }
      : null;

  if (!source || !source.name) {
    return <span className={className}>{fallback}</span>;
  }

  return <span className={className}>{formatActor(source)}</span>;
}

export default ActorName;

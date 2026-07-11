/**
 * Tekiō team-stats — aggregate adaptation counts across all agents.
 *
 * Uses `adaptations.agent_id` (added in migration 024) to attribute each
 * adaptation to a specific agent on a bipartite team.
 *
 * Schema is qualified with `public.` because Neon's HTTP driver does not
 * preserve `SET search_path` between tagged-template invocations.
 */

import { getClient } from "./client.js";

export interface TekioTeamStats {
  totalActive: number;
  perAgent: { agent_id: string | null; count: number }[];
  topApplied: {
    id: string;
    trigger_pattern: string;
    agent_id: string | null;
    times_applied: number;
  }[];
  topPrevented: {
    id: string;
    trigger_pattern: string;
    agent_id: string | null;
    times_prevented: number;
  }[];
}

export async function tekioTeamStats(): Promise<TekioTeamStats> {
  const sql = getClient();

  const totalRows = await sql`
    SELECT COUNT(*)::int AS total
    FROM public.adaptations
    WHERE is_active = true
  `;

  const perAgentRows = await sql`
    SELECT agent_id, COUNT(*)::int AS count
    FROM public.adaptations
    WHERE is_active = true
    GROUP BY agent_id
    ORDER BY count DESC
  `;

  // "this month" = adaptations applied within the trailing 30 days
  const topAppliedRows = await sql`
    SELECT id, trigger_pattern, agent_id, times_applied
    FROM public.adaptations
    WHERE is_active = true
      AND times_applied > 0
      AND (last_applied_at IS NULL OR last_applied_at >= NOW() - INTERVAL '30 days')
    ORDER BY times_applied DESC, created_at DESC
    LIMIT 5
  `;

  const topPreventedRows = await sql`
    SELECT id, trigger_pattern, agent_id, times_prevented
    FROM public.adaptations
    WHERE is_active = true AND times_prevented > 0
    ORDER BY times_prevented DESC, created_at DESC
    LIMIT 5
  `;

  const totalRow = (totalRows as { total: number }[])[0];
  return {
    totalActive: Number(totalRow?.total ?? 0),
    perAgent: (perAgentRows as { agent_id: string | null; count: number }[]).map((r) => ({
      agent_id: r.agent_id,
      count: Number(r.count),
    })),
    topApplied: (
      topAppliedRows as {
        id: string;
        trigger_pattern: string;
        agent_id: string | null;
        times_applied: number;
      }[]
    ).map((r) => ({
      id: r.id,
      trigger_pattern: r.trigger_pattern,
      agent_id: r.agent_id,
      times_applied: Number(r.times_applied),
    })),
    topPrevented: (
      topPreventedRows as {
        id: string;
        trigger_pattern: string;
        agent_id: string | null;
        times_prevented: number;
      }[]
    ).map((r) => ({
      id: r.id,
      trigger_pattern: r.trigger_pattern,
      agent_id: r.agent_id,
      times_prevented: Number(r.times_prevented),
    })),
  };
}

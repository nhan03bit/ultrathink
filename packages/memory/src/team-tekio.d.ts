/**
 * Tekiō team-stats — aggregate adaptation counts across all agents.
 *
 * Uses `adaptations.agent_id` (added in migration 024) to attribute each
 * adaptation to a specific agent on a bipartite team.
 *
 * Schema is qualified with `public.` because Neon's HTTP driver does not
 * preserve `SET search_path` between tagged-template invocations.
 */
export interface TekioTeamStats {
  totalActive: number;
  perAgent: {
    agent_id: string | null;
    count: number;
  }[];
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
export declare function tekioTeamStats(): Promise<TekioTeamStats>;

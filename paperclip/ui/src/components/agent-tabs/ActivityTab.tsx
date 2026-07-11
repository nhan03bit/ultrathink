// intent: per-agent activity tab — thin wrapper around the shared
//   <ActivityTimeline> that fetches per-agent events from the ut-bridge
//   (`GET /agents/:id/activity`). The presentational/event-rendering logic was
//   lifted to components/ActivityTimeline.tsx so the per-human HumanDetail tab
//   can reuse it (rev 2, INU-21 design doc, §Type changes #3).
// status: done
// confidence: high

import { useQuery } from "@tanstack/react-query";
import { utBridge, type UTActivityEvent } from "../../api/utBridge";
import { ActivityTimeline } from "../ActivityTimeline";

export function AgentActivityTab({ agentId }: { agentId: string }) {
  const { data, isLoading } = useQuery<UTActivityEvent[] | null>({
    queryKey: ["ut-bridge", "activity", agentId],
    queryFn: () => utBridge.activity(agentId),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const events = data ?? [];
  return <ActivityTimeline events={events} isLoading={isLoading} emptyMessage="No activity yet for this agent." />;
}

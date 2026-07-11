// intent: shared activity timeline — renders a UTActivityEvent[] for both the
//   per-agent (AgentDetail Activity tab) and per-human (HumanDetail Activity
//   tab) views. Lifted from components/agent-tabs/ActivityTab.tsx in rev 2 of
//   the INU-21 design doc to avoid duplicating EventRow + LENS_META.
// status: done
// confidence: high

import { Brain, Sparkles, FileCheck2, Activity, GitPullRequest, AlertTriangle } from "lucide-react";
import type { UTActivityEvent } from "../api/utBridge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "../lib/utils";

const LENS_META: Record<UTActivityEvent["lens"], { label: string; icon: typeof Brain; tint: string }> = {
  memory: { label: "Memory", icon: Brain, tint: "text-violet-500" },
  tekio: { label: "Tekiō", icon: Sparkles, tint: "text-emerald-500" },
  "design-doc": { label: "Design doc", icon: FileCheck2, tint: "text-blue-500" },
  paperclip: { label: "Paperclip", icon: GitPullRequest, tint: "text-amber-500" },
};

function relativeFromNow(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function EventRow({ e }: { e: UTActivityEvent }) {
  const meta = LENS_META[e.lens];
  const Icon = meta.icon;
  return (
    <li className="flex gap-3 py-2.5 border-b border-border last:border-b-0">
      <div className="shrink-0 mt-0.5">
        <Icon className={cn("h-4 w-4", meta.tint)} />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{meta.label}</span>
          <span className="text-[10px] text-muted-foreground">· {e.kind}</span>
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{relativeFromNow(e.at)}</span>
        </div>
        <p className="text-sm font-medium leading-snug truncate">{e.title}</p>
        {e.detail && <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">{e.detail}</p>}
      </div>
    </li>
  );
}

export function ActivityTimeline({
  events,
  isLoading = false,
  paperclipUnavailable = false,
  emptyMessage = "No activity yet.",
}: {
  events: UTActivityEvent[];
  isLoading?: boolean;
  paperclipUnavailable?: boolean;
  emptyMessage?: string;
}) {
  const counts = events.reduce(
    (acc, e) => {
      acc[e.lens] = (acc[e.lens] ?? 0) + 1;
      return acc;
    },
    {} as Record<UTActivityEvent["lens"], number>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">Activity timeline</h2>
        <span className="text-xs text-muted-foreground">{events.length} events</span>
        <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Brain className="h-3 w-3 text-violet-500" />
            {counts.memory ?? 0}
          </span>
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-emerald-500" />
            {counts.tekio ?? 0}
          </span>
          <span className="flex items-center gap-1">
            <FileCheck2 className="h-3 w-3 text-blue-500" />
            {counts["design-doc"] ?? 0}
          </span>
          <span className="flex items-center gap-1">
            <GitPullRequest className="h-3 w-3 text-amber-500" />
            {counts.paperclip ?? 0}
          </span>
        </div>
      </div>

      {paperclipUnavailable && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
        >
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Paperclip activity is temporarily unavailable. Showing memory events only — Paperclip-sourced events will
            return when the connection recovers.
          </span>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">{emptyMessage}</p>
      ) : (
        <ul className="rounded-md border border-border px-3 divide-y divide-border">
          {events.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </ul>
      )}
    </div>
  );
}

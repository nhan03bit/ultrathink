// intent: per-agent Tekiō adaptations panel — show what the wheel learned for this agent
// status: done
// confidence: high

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, Eye, Sword, Sparkles } from "lucide-react";
import { utBridge, type UTAdaptation } from "../../api/utBridge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "../../lib/utils";

const CATEGORY_META: Record<string, { label: string; icon: typeof Shield; tint: string }> = {
  defensive: { label: "Defensive", icon: Shield, tint: "text-blue-600 dark:text-blue-400" },
  auxiliary: { label: "Auxiliary", icon: Eye, tint: "text-violet-600 dark:text-violet-400" },
  offensive: { label: "Offensive", icon: Sword, tint: "text-red-600 dark:text-red-400" },
  learning: { label: "Learning", icon: Sparkles, tint: "text-emerald-600 dark:text-emerald-400" },
};

function severityBadge(s: number | null): string {
  if (s === null) return "bg-muted text-muted-foreground";
  if (s >= 8) return "bg-red-500/15 text-red-600 dark:text-red-400";
  if (s >= 5) return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
}

function AdaptationCard({ a }: { a: UTAdaptation }) {
  const meta = CATEGORY_META[a.category ?? ""] ?? {
    label: a.category ?? "—",
    icon: Sparkles,
    tint: "text-muted-foreground",
  };
  const Icon = meta.icon;
  return (
    <li className="rounded-md border border-border bg-card/40 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn("h-4 w-4 shrink-0", meta.tint)} />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{meta.label}</span>
          {!a.is_active && (
            <span className="rounded px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground">inactive</span>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
            severityBadge(a.severity)
          )}
          title={`severity ${a.severity ?? "n/a"}`}
        >
          sev {a.severity ?? "—"}
        </span>
      </div>

      <p className="text-sm font-medium leading-snug whitespace-pre-wrap">{a.adaptation_rule}</p>

      {a.trigger_pattern && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Trigger:</span> {a.trigger_pattern}
        </p>
      )}

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground tabular-nums">
        <span>applied {a.times_applied ?? 0}×</span>
        <span>prevented {a.times_prevented ?? 0}×</span>
        {a.scope && <span>scope: {a.scope}</span>}
        {a.last_applied_at && <span>last: {new Date(a.last_applied_at).toLocaleDateString()}</span>}
      </div>
    </li>
  );
}

export function AgentTekioTab({ agentId }: { agentId: string }) {
  const [showInactive, setShowInactive] = useState(false);
  const { data, isLoading } = useQuery<UTAdaptation[] | null>({
    queryKey: ["ut-bridge", "adaptations", agentId, showInactive],
    queryFn: () => utBridge.adaptations(agentId, { activeOnly: !showInactive }),
    staleTime: 30_000,
  });
  const items = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">Tekiō adaptations (☸ Cycle of Nova)</h2>
        <span className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "rule" : "rules"}
        </span>
        <label className="ml-auto text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-3 w-3"
          />
          Show inactive
        </label>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
          No adaptations matched this agent yet — the wheel hasn't found any
          {showInactive ? "" : " active"} patterns to learn.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <AdaptationCard key={a.id} a={a} />
          ))}
        </ul>
      )}
    </div>
  );
}

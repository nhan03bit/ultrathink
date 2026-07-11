// intent: per-agent skill-usage panel — top skills used in this agent's sessions
// status: done
// confidence: high

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Sparkles, XCircle } from "lucide-react";
import { utBridge, type UTSkillUsage } from "../../api/utBridge";
import { Skeleton } from "@/components/ui/skeleton";

function relativeFromNow(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatDuration(ms: number | null): string {
  if (!ms || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function SkillRow({ row }: { row: UTSkillUsage }) {
  const successRate = row.invocations ? Math.round((row.successes / row.invocations) * 100) : 0;
  return (
    <div className="grid grid-cols-12 gap-2 items-center px-3 py-2 border-b border-border last:border-b-0 text-xs">
      <div className="col-span-4 font-medium truncate" title={row.skill_id}>
        {row.skill_id}
      </div>
      <div className="col-span-2 tabular-nums text-right">{row.invocations}</div>
      <div className="col-span-2 tabular-nums text-right">
        <span
          className={
            successRate >= 80
              ? "text-green-600 dark:text-green-400"
              : successRate >= 50
                ? "text-amber-600 dark:text-amber-400"
                : "text-red-600 dark:text-red-400"
          }
        >
          {successRate}%
        </span>
      </div>
      <div className="col-span-2 tabular-nums text-right text-muted-foreground">
        {formatDuration(row.avg_duration_ms)}
      </div>
      <div className="col-span-2 tabular-nums text-right text-muted-foreground">
        {relativeFromNow(row.last_used_at)}
      </div>
    </div>
  );
}

export function AgentSkillsUsedTab({ agentId }: { agentId: string }) {
  const { data, isLoading } = useQuery<UTSkillUsage[] | null>({
    queryKey: ["ut-bridge", "skills-used", agentId],
    queryFn: () => utBridge.skills(agentId),
    staleTime: 30_000,
  });
  const skills = data ?? [];
  const totalInvocations = skills.reduce((acc, s) => acc + s.invocations, 0);
  const totalFailures = skills.reduce((acc, s) => acc + s.failures, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">Skills used</h2>
        <span className="text-xs text-muted-foreground">
          {skills.length} unique · {totalInvocations} total invocations
        </span>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : skills.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
          No skill usage tied to this agent yet.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 max-w-xl">
            <Stat label="Invocations" value={totalInvocations} />
            <Stat label="Failures" value={totalFailures} accent={totalFailures > 0 ? "warn" : "ok"} />
            <Stat
              label="Success rate"
              value={
                totalInvocations ? `${Math.round(((totalInvocations - totalFailures) / totalInvocations) * 100)}%` : "—"
              }
            />
          </div>

          <div className="rounded-md border border-border overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <div className="col-span-4">Skill</div>
              <div className="col-span-2 text-right">Calls</div>
              <div className="col-span-2 text-right">Success</div>
              <div className="col-span-2 text-right">Avg dur</div>
              <div className="col-span-2 text-right">Last used</div>
            </div>
            {skills.map((s) => (
              <SkillRow key={s.skill_id} row={s} />
            ))}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              success
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              failure
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: "ok" | "warn" }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={
          "text-lg font-medium tabular-nums " +
          (accent === "warn"
            ? "text-amber-600 dark:text-amber-400"
            : accent === "ok"
              ? "text-green-600 dark:text-green-400"
              : "")
        }
      >
        {value}
      </div>
    </div>
  );
}

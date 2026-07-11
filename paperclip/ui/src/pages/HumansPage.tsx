// intent: list view of humans (UltraThink Neon `humans` table) — the People
//   counterpart to Agents.tsx. Reads through the ut-bridge.
// status: done — v1: name, role (blank), timezone, github (linkified), last active.
// confidence: high

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, ExternalLink } from "lucide-react";
import { useNavigate } from "@/lib/router";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { utBridge, type UTHuman } from "../api/utBridge";
import { EntityRow } from "../components/EntityRow";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { relativeTime, cn } from "../lib/utils";

type FilterTab = "all" | "active" | "inactive";

function lastActive(h: UTHuman): string {
  return h.updated_at;
}

export function HumansPage() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const [tab, setTab] = useState<FilterTab>("all");

  useEffect(() => {
    setBreadcrumbs([{ label: "People" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["ut-bridge", "humans"],
    queryFn: () => utBridge.humans(),
    staleTime: 30_000,
  });

  const humans = useMemo(() => {
    const all = data ?? [];
    if (tab === "active") return all.filter((h) => h.is_active);
    if (tab === "inactive") return all.filter((h) => !h.is_active);
    return all;
  }, [data, tab]);

  if (isLoading) return <PageSkeleton variant="list" />;

  if (error) {
    return (
      <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Failed to load humans."}</p>
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState icon={Users} message="No humans on file yet." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">People</h1>
        <span className="text-xs text-muted-foreground">{humans.length} total</span>
        <div className="ml-auto flex items-center gap-1">
          {(["all", "active", "inactive"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "px-2 py-1 text-xs border border-border transition-colors capitalize",
                tab === t ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-border">
        {humans.map((h) => (
          <EntityRow
            key={h.id}
            title={h.name}
            subtitle={h.email ?? undefined}
            to={`/humans/${h.id}`}
            className={!h.is_active ? "opacity-60" : ""}
            leading={
              <span
                className={cn(
                  "relative flex h-2.5 w-2.5 rounded-full",
                  h.is_active ? "bg-emerald-500" : "bg-muted-foreground/30"
                )}
              />
            }
            trailing={
              <div className="hidden sm:flex items-center gap-3">
                {/* role — blank in v1 (humans.role is not a column) */}
                <span className="text-xs text-muted-foreground w-20 text-right">—</span>
                <span className="text-xs text-muted-foreground font-mono w-16 text-right">{h.timezone}</span>
                <span className="w-32 flex justify-end">
                  {h.github_username ? (
                    <a
                      href={`https://github.com/${h.github_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline no-underline"
                    >
                      @{h.github_username}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground w-16 text-right">
                  {lastActive(h) ? relativeTime(lastActive(h)) : "—"}
                </span>
              </div>
            }
            onClick={() => navigate(`/humans/${h.id}`)}
          />
        ))}
      </div>
    </div>
  );
}

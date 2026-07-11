// intent: detail view of a single human — Overview tab + Activity tab.
//   Tab pattern modeled on AgentDetail.tsx but trimmed to two tabs in v1.
// status: done
// confidence: high

import { useEffect } from "react";
import { useParams, useNavigate, Navigate } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, User, Clock, Mail, Github, Tag } from "lucide-react";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { utBridge, type UTHumanDetail } from "../api/utBridge";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { PageSkeleton } from "../components/PageSkeleton";
import { PageTabBar } from "../components/PageTabBar";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "../lib/utils";

type HumanDetailView = "overview" | "activity";

function parseTab(value: string | null | undefined): HumanDetailView {
  if (value === "activity") return "activity";
  return "overview";
}

export function HumanDetail() {
  const { humanId, tab: urlTab } = useParams<{ humanId: string; tab?: string }>();
  const navigate = useNavigate();
  const { setBreadcrumbs } = useBreadcrumbs();
  const activeView = parseTab(urlTab ?? null);
  const id = humanId ?? "";

  const { data, isLoading, error } = useQuery<UTHumanDetail | null>({
    queryKey: ["ut-bridge", "human", id],
    queryFn: () => utBridge.human(id),
    enabled: id.length > 0,
    staleTime: 15_000,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "People", href: "/humans" }, { label: data?.name ?? id }]);
  }, [setBreadcrumbs, data?.name, id]);

  if (!id) return <Navigate to="/humans" replace />;
  if (isLoading) return <PageSkeleton variant="detail" />;
  if (error)
    return (
      <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Failed to load human."}</p>
    );
  if (!data) {
    return <p className="text-sm text-muted-foreground py-12 text-center">Human not found.</p>;
  }
  if (!urlTab) {
    return <Navigate to={`/humans/${id}/overview`} replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 flex items-center justify-center h-12 w-12 rounded-lg bg-accent">
            <User className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold truncate">{data.name}</h2>
            <p className="text-sm text-muted-foreground truncate">
              {data.is_active ? "Active" : "Inactive"} · {data.timezone}
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeView} onValueChange={(value) => navigate(`/humans/${id}/${value}`)}>
        <PageTabBar
          items={[
            { value: "overview", label: "Overview" },
            { value: "activity", label: "Activity" },
          ]}
          value={activeView}
          onValueChange={(value) => navigate(`/humans/${id}/${value}`)}
        />
      </Tabs>

      {activeView === "overview" && <OverviewTab data={data} />}

      {activeView === "activity" && (
        <div className="max-w-3xl">
          <ActivityTimeline
            events={data.recent_activity ?? []}
            paperclipUnavailable={data.meta?.paperclip_unavailable ?? false}
            emptyMessage="No activity yet for this person."
          />
        </div>
      )}
    </div>
  );
}

function OverviewTab({ data }: { data: UTHumanDetail }) {
  return (
    <div className="max-w-3xl grid gap-3 sm:grid-cols-2">
      <Field icon={Mail} label="Email" value={data.email ?? "—"} />
      <Field
        icon={Github}
        label="GitHub"
        value={
          data.github_username ? (
            <a
              href={`https://github.com/${data.github_username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline no-underline"
            >
              @{data.github_username}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            "—"
          )
        }
      />
      <Field icon={Clock} label="Timezone" value={data.timezone} />
      <Field icon={Clock} label="Working hours" value={`${data.working_hours_start}–${data.working_hours_end}`} />
      <Field icon={Tag} label="Role" value="—" />
      <Field
        icon={User}
        label="Paperclip user id"
        value={data.paperclip_user_id ? <code className="text-xs">{data.paperclip_user_id}</code> : "—"}
      />
    </div>
  );
}

function Field({ icon: Icon, label, value }: { icon: typeof User; label: string; value: React.ReactNode }) {
  return (
    <div className={cn("flex items-start gap-3 border border-border p-3")}>
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <div className="text-sm mt-0.5 break-words">{value}</div>
      </div>
    </div>
  );
}

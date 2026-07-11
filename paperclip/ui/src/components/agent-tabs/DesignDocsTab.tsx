// intent: per-agent design-doc panel — issues this agent reviewed/approved
// status: done
// confidence: high

import { useQuery } from "@tanstack/react-query";
import { FileCheck2, FileSignature, ExternalLink } from "lucide-react";
import { Link } from "@/lib/router";
import { utBridge, type UTDesignDocBundle } from "../../api/utBridge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "../../lib/utils";

function verdictColor(v: string | null): string {
  if (!v) return "bg-muted text-muted-foreground";
  const lower = v.toLowerCase();
  if (lower.includes("approve") || lower === "lgtm") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (lower.includes("reject") || lower.includes("block")) return "bg-red-500/15 text-red-600 dark:text-red-400";
  if (lower.includes("change") || lower.includes("revise")) return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
}

export function AgentDesignDocsTab({ agentId, companyPrefix }: { agentId: string; companyPrefix?: string }) {
  const { data, isLoading } = useQuery<UTDesignDocBundle | null>({
    queryKey: ["ut-bridge", "design-docs", agentId],
    queryFn: () => utBridge.designDocs(agentId),
    staleTime: 30_000,
  });

  const reviews = data?.reviews ?? [];
  const approvals = data?.approvals ?? [];
  const titles = data?.issueTitles ?? {};

  function issueLink(issueId: string | null): string | null {
    if (!issueId) return null;
    if (companyPrefix) return `/c/${companyPrefix}/issues/${issueId}`;
    return `/issues/${issueId}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileCheck2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">Design docs</h2>
        <span className="text-xs text-muted-foreground">
          {reviews.length} reviews · {approvals.length} approvals
        </span>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : reviews.length === 0 && approvals.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
          This agent hasn't reviewed or approved any design docs yet.
        </p>
      ) : (
        <>
          {reviews.length > 0 && (
            <section>
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Reviews</h3>
              <ul className="space-y-2">
                {reviews.map((r) => {
                  const href = issueLink(r.paperclip_issue_id);
                  const title = r.paperclip_issue_id
                    ? (titles[r.paperclip_issue_id] ?? r.paperclip_issue_id)
                    : "(no issue)";
                  return (
                    <li key={r.id} className="rounded-md border border-border bg-card/40 p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {href ? (
                            <Link
                              to={href}
                              className="text-sm font-medium hover:underline truncate inline-flex items-center gap-1"
                            >
                              {title}
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                            </Link>
                          ) : (
                            <span className="text-sm font-medium truncate">{title}</span>
                          )}
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                            verdictColor(r.verdict)
                          )}
                        >
                          {r.verdict ?? "—"}
                        </span>
                      </div>
                      {r.comment && (
                        <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{r.comment}</p>
                      )}
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                        {r.lane && <span>{r.lane} lane</span>}
                        {r.revision_number !== null && <span>rev #{r.revision_number}</span>}
                        <span className="ml-auto">{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {approvals.length > 0 && (
            <section>
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <FileSignature className="h-3 w-3" /> Approvals
              </h3>
              <ul className="space-y-2">
                {approvals.map((a) => (
                  <li key={a.id} className="rounded-md border border-border bg-card/40 p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        rev {a.paperclip_revision_id?.slice(0, 8) ?? "—"}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {new Date(a.approved_at).toLocaleDateString()}
                      </span>
                    </div>
                    {a.decision_note && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{a.decision_note}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

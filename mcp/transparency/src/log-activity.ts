// intent: Map a PaperclipEvent -> activity_log row + INSERT it via Neon.
// status: done (M7 scaffold — Discord fan-out is a stub for M4)
// next: M4 fills postToDiscord() and wires subscribe() in index.ts to the live event bus.
// confidence: high

import { neon } from "@neondatabase/serverless";
import type { ActivityLogRow, ActorRef, PaperclipEvent } from "./types.js";

let sqlClient: ReturnType<typeof neon> | null = null;

function getSql() {
  if (!sqlClient) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is required for @inuverse/transparency");
    }
    sqlClient = neon(url);
  }
  return sqlClient;
}

/**
 * Map an event onto an activity_log row.
 * Pure function — no side effects, fully testable.
 */
export function eventToRow(event: PaperclipEvent): ActivityLogRow {
  const base = {
    occurred_at: event.occurredAt,
    actor_type: event.actor.type,
    actor_id: event.actor.id ?? null,
    actor_name: event.actor.name,
    actor_title: event.actor.title ?? null,
    trigger_type: event.trigger.type,
    triggered_by_actor_type: event.trigger.by?.type ?? null,
    triggered_by_actor_id: event.trigger.by?.id ?? null,
    triggered_by_actor_name: event.trigger.by?.name ?? null,
    paperclip_company_id: event.scope.paperclipCompanyId ?? null,
    project_id: event.scope.projectId ?? null,
    issue_id: event.scope.issueId ?? null,
    paperclip_run_id: event.scope.paperclipRunId ?? null,
    cost_usd: null as number | null,
    metadata: event.metadata ?? {},
  };

  switch (event.kind) {
    case "issue.created":
      return {
        ...base,
        verb: "created",
        object_type: "issue",
        object_id: event.issueId,
        object_label: event.issueLabel,
        metadata: { ...base.metadata, title: event.title },
      };
    case "issue.commented":
      return {
        ...base,
        verb: "commented",
        object_type: "comment",
        object_id: event.commentId,
        object_label: event.issueLabel,
        issue_id: event.issueId,
        metadata: { ...base.metadata, body: event.body },
      };
    case "issue.assigned":
      return {
        ...base,
        verb: "assigned",
        object_type: "issue",
        object_id: event.issueId,
        object_label: event.issueLabel,
        metadata: { ...base.metadata, assignee: event.assignee },
      };
    case "issue.completed":
      return {
        ...base,
        verb: "completed",
        object_type: "issue",
        object_id: event.issueId,
        object_label: event.issueLabel,
      };
    case "issue.cancelled":
      return {
        ...base,
        verb: "cancelled",
        object_type: "issue",
        object_id: event.issueId,
        object_label: event.issueLabel,
        metadata: { ...base.metadata, reason: event.reason },
      };
    case "issue.blocked":
      return {
        ...base,
        verb: "blocked",
        object_type: "issue",
        object_id: event.issueId,
        object_label: event.issueLabel,
        metadata: { ...base.metadata, reason: event.reason },
      };
    case "document.created":
      return {
        ...base,
        verb: "created",
        object_type: "document",
        object_id: event.documentId,
        object_label: event.title,
        metadata: { ...base.metadata, revisionNumber: event.revisionNumber },
      };
    case "document.reviewed":
      return {
        ...base,
        verb: "reviewed",
        object_type: "review",
        object_id: event.reviewId,
        object_label: `${event.lane}:${event.verdict}`,
        metadata: { ...base.metadata, lane: event.lane, verdict: event.verdict, documentId: event.documentId },
      };
    case "document.approved":
      return {
        ...base,
        verb: "approved",
        object_type: "approval",
        object_id: event.documentId,
        object_label: `rev ${event.revisionNumber}`,
        metadata: { ...base.metadata, revisionNumber: event.revisionNumber },
      };
    case "heartbeat_run.started":
      return {
        ...base,
        verb: "wake",
        object_type: "run",
        object_id: event.runId,
        object_label: null,
      };
    case "heartbeat_run.completed":
      return {
        ...base,
        verb: event.shippedLabel ? "shipped" : "completed",
        object_type: event.shippedLabel ? "pr" : "run",
        object_id: event.runId,
        object_label: event.shippedLabel ?? null,
        cost_usd: event.costUsd,
        paperclip_run_id: event.runId,
      };
    case "heartbeat_run.errored":
      return {
        ...base,
        verb: "errored",
        object_type: "run",
        object_id: event.runId,
        object_label: null,
        paperclip_run_id: event.runId,
        metadata: { ...base.metadata, errorMessage: event.errorMessage },
      };
    case "budget.exceeded":
      return {
        ...base,
        verb: "budget_exceeded",
        object_type: "budget",
        object_id: event.budgetId,
        object_label: null,
        metadata: { ...base.metadata, spentUsd: event.spentUsd, limitUsd: event.limitUsd },
      };
    case "agent.wake":
      return {
        ...base,
        verb: "wake",
        object_type: "agent",
        object_id: event.actor.id,
        object_label: event.actor.name,
        metadata: { ...base.metadata, reason: event.reason },
      };
    case "agent.mentioned":
      return {
        ...base,
        verb: "mentioned",
        object_type: event.contextObjectType,
        object_id: event.contextObjectId,
        object_label: event.contextObjectLabel ?? null,
        metadata: { ...base.metadata, mentionedAgent: event.agentRef },
      };
    case "agent.errored":
      return {
        ...base,
        verb: "errored",
        object_type: "agent",
        object_id: event.actor.id,
        object_label: event.actor.name,
        metadata: { ...base.metadata, errorMessage: event.errorMessage },
      };
  }
}

/**
 * Stub: M4 will replace this with a real Discord webhook post.
 * Kept here so `recordActivity` already has the call site wired up.
 */
async function postToDiscord(_row: ActivityLogRow, _actor: ActorRef): Promise<void> {
  // intent: M4 will format `_row` into a Discord embed and POST to the company's webhook.
  // status: stub
  // next: M4 implements the HTTP call.
  return;
}

/**
 * Insert a single activity_log row from a PaperclipEvent.
 * Called by the M4 subscriber in `index.ts#subscribe()`.
 */
export async function recordActivity(event: PaperclipEvent): Promise<void> {
  const row = eventToRow(event);
  const sql = getSql();

  await sql`
    INSERT INTO activity_log (
      occurred_at,
      actor_type, actor_id, actor_name, actor_title,
      trigger_type, triggered_by_actor_type, triggered_by_actor_id, triggered_by_actor_name,
      verb, object_type, object_id, object_label,
      paperclip_company_id, project_id, issue_id, paperclip_run_id,
      cost_usd, metadata
    ) VALUES (
      ${row.occurred_at},
      ${row.actor_type}, ${row.actor_id}, ${row.actor_name}, ${row.actor_title},
      ${row.trigger_type}, ${row.triggered_by_actor_type}, ${row.triggered_by_actor_id}, ${row.triggered_by_actor_name},
      ${row.verb}, ${row.object_type}, ${row.object_id}, ${row.object_label},
      ${row.paperclip_company_id}, ${row.project_id}, ${row.issue_id}, ${row.paperclip_run_id},
      ${row.cost_usd}, ${JSON.stringify(row.metadata)}::jsonb
    )
  `;

  // Fan-out to Discord (M4 implements the actual posting).
  await postToDiscord(row, event.actor);
}

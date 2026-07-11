// intent: Discriminated union over every Paperclip event the transparency plugin cares about.
// status: done
// next: M4 will add the live subscriber that emits these into recordActivity().
// confidence: high

/** Stable identifier for any actor in the system (agent UUID, human UUID, or 'system'). */
export type ActorType = "agent" | "human" | "system";

export interface ActorRef {
  type: ActorType;
  id: string;
  name: string;
  /** "CEO", "Engineer", etc. — present for agents, omitted for humans/system. */
  title?: string;
}

/** Why did this action happen? Drives the dashboard's four-lens filtering. */
export type TriggerType =
  | "direct" // actor decided on their own
  | "human_mention" // a human @-mentioned an agent in chat / issue / doc
  | "agent_handoff" // upstream agent passed work downstream
  | "scheduled" // cron / heartbeat
  | "system"; // platform-emitted event (budget breach, error, etc.)

export interface TriggerRef {
  type: TriggerType;
  by?: ActorRef;
}

/** Common envelope every event shares. */
interface BaseEvent {
  occurredAt: string; // ISO-8601
  actor: ActorRef;
  trigger: TriggerRef;
  scope: {
    paperclipCompanyId?: string;
    projectId?: string;
    issueId?: string;
    paperclipRunId?: string;
  };
  metadata?: Record<string, unknown>;
}

// ─── Issue events ────────────────────────────────────────────────────────────
export interface IssueCreatedEvent extends BaseEvent {
  kind: "issue.created";
  issueId: string;
  issueLabel: string; // "INU-16"
  title: string;
}

export interface IssueCommentedEvent extends BaseEvent {
  kind: "issue.commented";
  issueId: string;
  issueLabel: string;
  commentId: string;
  body: string;
}

export interface IssueAssignedEvent extends BaseEvent {
  kind: "issue.assigned";
  issueId: string;
  issueLabel: string;
  assignee: ActorRef;
}

export interface IssueCompletedEvent extends BaseEvent {
  kind: "issue.completed";
  issueId: string;
  issueLabel: string;
}

export interface IssueCancelledEvent extends BaseEvent {
  kind: "issue.cancelled";
  issueId: string;
  issueLabel: string;
  reason?: string;
}

export interface IssueBlockedEvent extends BaseEvent {
  kind: "issue.blocked";
  issueId: string;
  issueLabel: string;
  reason?: string;
}

// ─── Document events ─────────────────────────────────────────────────────────
export interface DocumentCreatedEvent extends BaseEvent {
  kind: "document.created";
  documentId: string;
  title: string;
  revisionNumber: number;
}

export interface DocumentReviewedEvent extends BaseEvent {
  kind: "document.reviewed";
  documentId: string;
  reviewId: string;
  lane: "code" | "quality" | "devops";
  verdict: "approve" | "changes-requested" | "block";
}

export interface DocumentApprovedEvent extends BaseEvent {
  kind: "document.approved";
  documentId: string;
  revisionNumber: number;
}

// ─── Heartbeat run events ────────────────────────────────────────────────────
export interface HeartbeatRunStartedEvent extends BaseEvent {
  kind: "heartbeat_run.started";
  runId: string;
}

export interface HeartbeatRunCompletedEvent extends BaseEvent {
  kind: "heartbeat_run.completed";
  runId: string;
  costUsd: number;
  shippedLabel?: string; // "PR #235" if a PR was opened
}

export interface HeartbeatRunErroredEvent extends BaseEvent {
  kind: "heartbeat_run.errored";
  runId: string;
  errorMessage: string;
}

// ─── Budget events ───────────────────────────────────────────────────────────
export interface BudgetExceededEvent extends BaseEvent {
  kind: "budget.exceeded";
  budgetId: string;
  scope: BaseEvent["scope"];
  spentUsd: number;
  limitUsd: number;
}

// ─── Agent events ────────────────────────────────────────────────────────────
export interface AgentWakeEvent extends BaseEvent {
  kind: "agent.wake";
  reason: string;
}

export interface AgentMentionedEvent extends BaseEvent {
  kind: "agent.mentioned";
  agentRef: ActorRef;
  contextObjectType: "issue" | "document" | "comment";
  contextObjectId: string;
  contextObjectLabel?: string;
}

export interface AgentErroredEvent extends BaseEvent {
  kind: "agent.errored";
  errorMessage: string;
}

// ─── Union ───────────────────────────────────────────────────────────────────
export type PaperclipEvent =
  | IssueCreatedEvent
  | IssueCommentedEvent
  | IssueAssignedEvent
  | IssueCompletedEvent
  | IssueCancelledEvent
  | IssueBlockedEvent
  | DocumentCreatedEvent
  | DocumentReviewedEvent
  | DocumentApprovedEvent
  | HeartbeatRunStartedEvent
  | HeartbeatRunCompletedEvent
  | HeartbeatRunErroredEvent
  | BudgetExceededEvent
  | AgentWakeEvent
  | AgentMentionedEvent
  | AgentErroredEvent;

/** Shape of a row written to `activity_log`. Mirrors migrations/021_activity_log.sql. */
export interface ActivityLogRow {
  occurred_at: string;
  actor_type: ActorType;
  actor_id: string | null;
  actor_name: string;
  actor_title: string | null;
  trigger_type: TriggerType;
  triggered_by_actor_type: ActorType | null;
  triggered_by_actor_id: string | null;
  triggered_by_actor_name: string | null;
  verb: string;
  object_type: string | null;
  object_id: string | null;
  object_label: string | null;
  paperclip_company_id: string | null;
  project_id: string | null;
  issue_id: string | null;
  paperclip_run_id: string | null;
  cost_usd: number | null;
  metadata: Record<string, unknown>;
}

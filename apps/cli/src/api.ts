// intent: minimal Paperclip REST client for ut CLI
// status: done
// next: add retry with backoff for 5xx; surface request id from response headers
// confidence: high
//
// Uses undici.request for keep-alive perf. local_trusted means no auth header.

import { request } from "undici";
import { PAPERCLIP_API_URL, COMPANY_ID } from "./config.js";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function call<T>(method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT", path: string, body?: unknown): Promise<T> {
  const url = `${PAPERCLIP_API_URL}${path}`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };
  const res = await request(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.body.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (res.statusCode >= 400) {
    throw new ApiError(
      `HTTP ${res.statusCode} ${method} ${path} :: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`,
      res.statusCode,
      parsed
    );
  }
  return parsed as T;
}

/* ─── Types (just enough for table rendering) ─────────────────── */

export interface Agent {
  id: string;
  companyId: string;
  name: string;
  role: string;
  title: string | null;
  status: string;
  reportsTo: string | null;
  capabilities: string | null;
  budgetMonthlyCents: number | null;
  spentMonthlyCents: number | null;
  pauseReason: string | null;
  lastHeartbeatAt: string | null;
  urlKey: string;
}

export interface Project {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  status?: string;
  archivedAt?: string | null;
}

export interface Issue {
  id: string;
  companyId: string;
  identifier: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeAgentId: string | null;
  assigneeUserId: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IssueComment {
  id: string;
  issueId: string;
  body: string;
  authorAgentId: string | null;
  authorUserId: string | null;
  createdAt: string;
}

/* ─── Agent endpoints ─────────────────────────────────────────── */

export async function listAgents(): Promise<Agent[]> {
  return call<Agent[]>("GET", `/api/companies/${COMPANY_ID}/agents`);
}

export async function getAgent(id: string): Promise<Agent> {
  return call<Agent>("GET", `/api/agents/${id}`);
}

export async function wakeAgent(id: string, reason?: string): Promise<{ ok: boolean; runId?: string }> {
  return call("POST", `/api/agents/${id}/wakeup`, {
    source: "on_demand",
    triggerDetail: "manual",
    reason: reason ?? null,
  });
}

/* ─── Project endpoints ───────────────────────────────────────── */

export async function listProjects(): Promise<Project[]> {
  return call<Project[]>("GET", `/api/companies/${COMPANY_ID}/projects`);
}

/* ─── Issue endpoints ─────────────────────────────────────────── */

export interface IssueListFilter {
  status?: string;
  assigneeAgentId?: string;
  projectId?: string;
  limit?: number;
}

export async function listIssues(filter: IssueListFilter = {}): Promise<Issue[]> {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.assigneeAgentId) params.set("assigneeAgentId", filter.assigneeAgentId);
  if (filter.projectId) params.set("projectId", filter.projectId);
  if (filter.limit) params.set("limit", String(filter.limit));
  const qs = params.toString();
  const result = await call<Issue[] | { issues: Issue[] }>(
    "GET",
    `/api/companies/${COMPANY_ID}/issues${qs ? `?${qs}` : ""}`
  );
  return Array.isArray(result) ? result : (result.issues ?? []);
}

export async function getIssue(idOrIdentifier: string): Promise<Issue> {
  // Paperclip's GET /issues/:id accepts both UUIDs and identifiers (INU-N)
  return call<Issue>("GET", `/api/issues/${idOrIdentifier}`);
}

export async function createIssue(input: {
  title: string;
  description?: string;
  assigneeAgentId?: string;
  projectId?: string;
  status?: string;
  priority?: string;
}): Promise<Issue> {
  return call<Issue>("POST", `/api/companies/${COMPANY_ID}/issues`, input);
}

export async function updateIssue(
  id: string,
  patch: {
    status?: string;
    assigneeAgentId?: string | null;
    title?: string;
    description?: string | null;
    comment?: string;
  }
): Promise<Issue> {
  return call<Issue>("PATCH", `/api/issues/${id}`, patch);
}

export async function listIssueComments(issueId: string): Promise<IssueComment[]> {
  const r = await call<IssueComment[] | { comments: IssueComment[] }>("GET", `/api/issues/${issueId}/comments`);
  return Array.isArray(r) ? r : (r.comments ?? []);
}

export async function addIssueComment(issueId: string, body: string): Promise<IssueComment> {
  return call<IssueComment>("POST", `/api/issues/${issueId}/comments`, {
    body,
  });
}

export async function getIssueDocument(
  issueId: string,
  key = "design-doc"
): Promise<{
  doc: { id: string; revisionNumber: number };
  revision: { id: string; revisionNumber: number };
  sections?: unknown;
  body?: string;
} | null> {
  try {
    return await call("GET", `/api/issues/${issueId}/documents/${key}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

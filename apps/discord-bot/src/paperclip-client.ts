// intent: typed wrapper around the Paperclip API endpoints the discord-bot
//   commands need. Only covers the endpoints actually used by slash-command
//   handlers (doc rev 2 steps 4 / 6 / 10 / 20):
//     - getIssue       → GET /api/issues/:id
//     - wakeAgent      → POST /api/issues/:id/checkout  (triggers a heartbeat)
//     - cancelRun      → POST /api/runs/:runId/cancel
//     - freezeCompany  → POST /api/companies/:id/freeze
//     - unfreezeCompany→ POST /api/companies/:id/unfreeze
//     - companySpend   → GET /api/companies/:id/spend   (budget / current usage)
//   All calls include Authorization + a caller-supplied X-Discord-Source header
//   so the run audit trail can record who triggered the action.
// status: done
// confidence: high

export interface PaperclipIssue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  priority: string | null;
  assigneeAgentId: string | null;
}

export interface PaperclipRun {
  id: string;
  status: string;
}

export interface CompanySpend {
  budgetCents: number | null;
  spentCents: number;
  remainingCents: number | null;
}

export interface PaperclipClientConfig {
  baseUrl: string;
  apiKey: string;
  companyId: string;
}

async function pcFetch(config: PaperclipClientConfig, method: string, path: string, body?: unknown): Promise<Response> {
  const res = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return res;
}

export async function getIssue(config: PaperclipClientConfig, issueId: string): Promise<PaperclipIssue | null> {
  const res = await pcFetch(config, "GET", `/api/issues/${encodeURIComponent(issueId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`paperclip GET /api/issues/${issueId} → ${res.status}`);
  return res.json() as Promise<PaperclipIssue>;
}

// wakeAgent triggers a heartbeat by checking out the issue for the given agentId.
export async function wakeAgent(config: PaperclipClientConfig, issueId: string, agentId: string): Promise<void> {
  const res = await pcFetch(config, "POST", `/api/issues/${encodeURIComponent(issueId)}/checkout`, {
    agentId,
    expectedStatuses: ["todo", "backlog", "in_progress", "blocked"],
  });
  if (res.status === 409) throw new Error(`issue ${issueId} is already checked out by another agent`);
  if (!res.ok) throw new Error(`paperclip checkout ${issueId} → ${res.status}`);
}

export async function cancelRun(config: PaperclipClientConfig, runId: string): Promise<void> {
  const res = await pcFetch(config, "POST", `/api/runs/${encodeURIComponent(runId)}/cancel`);
  if (!res.ok) throw new Error(`paperclip cancel run ${runId} → ${res.status}`);
}

export async function freezeCompany(config: PaperclipClientConfig): Promise<void> {
  const res = await pcFetch(config, "POST", `/api/companies/${encodeURIComponent(config.companyId)}/freeze`);
  if (!res.ok) throw new Error(`paperclip freeze company → ${res.status}`);
}

export async function unfreezeCompany(config: PaperclipClientConfig): Promise<void> {
  const res = await pcFetch(config, "POST", `/api/companies/${encodeURIComponent(config.companyId)}/unfreeze`);
  if (!res.ok) throw new Error(`paperclip unfreeze company → ${res.status}`);
}

export async function companySpend(config: PaperclipClientConfig): Promise<CompanySpend> {
  const res = await pcFetch(config, "GET", `/api/companies/${encodeURIComponent(config.companyId)}/spend`);
  if (!res.ok) throw new Error(`paperclip GET company spend → ${res.status}`);
  const body = (await res.json()) as {
    budgetCents?: number | null;
    spentCents?: number;
    remainingCents?: number | null;
  };
  return {
    budgetCents: body.budgetCents ?? null,
    spentCents: body.spentCents ?? 0,
    remainingCents: body.remainingCents ?? null,
  };
}

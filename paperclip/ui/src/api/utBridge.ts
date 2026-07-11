// intent: tiny client for the UltraThink bridge service (apps/ut-bridge on :3201)
// status: done — all read-only GETs, fail-soft (returns null on network error)
// confidence: high

const BASE = (() => {
  if (typeof window !== "undefined") {
    // dev / prod: bridge runs on a fixed loopback port
    return "http://127.0.0.1:3201";
  }
  return "http://127.0.0.1:3201";
})();

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${BASE}${path}`, { credentials: "omit" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export type UTMemory = {
  id: string;
  wing: string | null;
  hall: string | null;
  room: string | null;
  layer: number | null;
  category: string | null;
  importance: number | null;
  confidence: string | number | null;
  title: string | null;
  content: string;
  source: string | null;
  created_at: string;
  updated_at: string;
  access_count: number | null;
  token_estimate: number | null;
};

export type UTSkillUsage = {
  skill_id: string;
  invocations: number;
  successes: number;
  failures: number;
  avg_duration_ms: number | null;
  last_used_at: string;
};

export type UTAdaptation = {
  id: string;
  trigger_pattern: string | null;
  adaptation_rule: string;
  source_failure: string | null;
  category: string | null;
  severity: number | null;
  scope: string | null;
  times_applied: number | null;
  times_prevented: number | null;
  is_active: boolean;
  created_at: string;
  last_applied_at: string | null;
  tags: string[] | null;
};

export type UTDesignDocBundle = {
  reviews: Array<{
    id: string;
    paperclip_doc_id: string | null;
    paperclip_issue_id: string | null;
    paperclip_revision_id: string | null;
    revision_number: number | null;
    lane: string | null;
    verdict: string | null;
    comment: string | null;
    reviewer_agent_id: string;
    superseded_by: string | null;
    created_at: string;
  }>;
  approvals: Array<{
    id: string;
    paperclip_doc_id: string | null;
    paperclip_revision_id: string | null;
    approver_agent_id: string;
    decision_note: string | null;
    approved_at: string;
  }>;
  issueTitles: Record<string, string>;
};

export type UTActivityEvent = {
  id: string;
  lens: "memory" | "tekio" | "design-doc" | "paperclip";
  kind: string;
  title: string;
  detail: string | null;
  importance: number | null;
  at: string;
  meta?: Record<string, unknown>;
};

export type UTHuman = {
  id: string;
  name: string;
  email: string | null;
  github_username: string | null;
  timezone: string;
  working_hours_start: string;
  working_hours_end: string;
  reports_to: string | null;
  is_active: boolean;
  paperclip_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type UTHumanDetail = UTHuman & {
  recent_activity: UTActivityEvent[];
  meta: { paperclip_unavailable: boolean };
};

export const utBridge = {
  baseUrl: BASE,
  health: () => getJson<{ ok: boolean; db: string }>("/health"),
  memories: (agentId: string, q?: string) =>
    getJson<UTMemory[]>(`/agents/${encodeURIComponent(agentId)}/memories${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  skills: (agentId: string) => getJson<UTSkillUsage[]>(`/agents/${encodeURIComponent(agentId)}/skills`),
  adaptations: (agentId: string, opts?: { activeOnly?: boolean }) =>
    getJson<UTAdaptation[]>(
      `/agents/${encodeURIComponent(agentId)}/adaptations${
        opts && opts.activeOnly === false ? "?activeOnly=false" : ""
      }`
    ),
  designDocs: (agentId: string) => getJson<UTDesignDocBundle>(`/agents/${encodeURIComponent(agentId)}/design-docs`),
  activity: (agentId: string, since?: string) =>
    getJson<UTActivityEvent[]>(
      `/agents/${encodeURIComponent(agentId)}/activity${since ? `?since=${encodeURIComponent(since)}` : ""}`
    ),
  humans: (opts?: { activeOnly?: boolean }) =>
    getJson<UTHuman[]>(`/humans${opts?.activeOnly ? "?activeOnly=true" : ""}`),
  human: (id: string) => getJson<UTHumanDetail>(`/humans/${encodeURIComponent(id)}`),
};

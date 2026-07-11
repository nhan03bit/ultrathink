// intent: synthetic agent/issue/thread builders used only by `ut chat --dry-run`
// status: done
// confidence: high
//
// Keeps chat.ts under the 1500-line ceiling and keeps the dry-run shape isolated.

import type { Agent, Issue } from "../api.js";

export interface DryThreadShape {
  agent: Agent;
  issue: Issue;
}

export function buildDryThread(name: string, message: string, ordinal: number): DryThreadShape {
  const key = name.toLowerCase();
  const fakeId = `DRY-${ordinal}`;
  const agent: Agent = {
    id: `dry-${key}`,
    companyId: "dry",
    name,
    role: "agent",
    title: null,
    status: "idle",
    reportsTo: null,
    capabilities: null,
    budgetMonthlyCents: null,
    spentMonthlyCents: null,
    pauseReason: null,
    lastHeartbeatAt: null,
    urlKey: key,
  };
  const now = new Date().toISOString();
  const issue: Issue = {
    id: fakeId,
    companyId: "dry",
    identifier: fakeId,
    title: message.length > 60 ? message.slice(0, 59) + "…" : message,
    description: message,
    status: "todo",
    priority: "normal",
    assigneeAgentId: agent.id,
    assigneeUserId: null,
    projectId: null,
    createdAt: now,
    updatedAt: now,
  };
  return { agent, issue };
}

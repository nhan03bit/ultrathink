#!/usr/bin/env node

/**
 * UltraThink × task.inugami.dev MCP Server
 *
 * Tools:
 *   list_teams          — enumerate workspace teams
 *   list_members        — teammates with name + role (filter by team_id)
 *   list_tasks          — tasks (filter by team_id and/or status)
 *   create_task         — add one task (assign by member_id)
 *   bulk_create_tasks   — add many tasks in one call
 *   create_team         — spin up a new team
 *   add_member          — onboard a teammate with name + role
 *
 * Required env: TASK_API_URL, TASK_API_TOKEN
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = (process.env.TASK_API_URL ?? "https://task.inugami.dev").replace(/\/$/, "");
const TOKEN = process.env.TASK_API_TOKEN ?? "";

if (!TOKEN) {
  process.stderr.write("[task-inugami] TASK_API_TOKEN is not set\n");
  process.exit(1);
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

const server = new McpServer({ name: "task-inugami", version: "1.0.0" });

/* ── list_teams ─────────────────────────────────────────────────── */

server.tool("list_teams", "List all teams in the workspace", {}, async () => {
  const data = await api<unknown>("GET", "/teams");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

/* ── list_members ───────────────────────────────────────────────── */

server.tool(
  "list_members",
  "List teammates with name + role. Optionally filter by team_id.",
  { team_id: z.string().optional().describe("Filter to members of this team") },
  async ({ team_id }) => {
    const qs = team_id ? `?team_id=${encodeURIComponent(team_id)}` : "";
    const data = await api<unknown>("GET", `/members${qs}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

/* ── list_tasks ─────────────────────────────────────────────────── */

server.tool(
  "list_tasks",
  "List tasks. Optionally filter by team_id and/or status.",
  {
    team_id: z.string().optional().describe("Restrict to this team"),
    status: z
      .enum(["backlog", "todo", "in_progress", "done", "cancelled"])
      .optional()
      .describe("Filter by task status"),
  },
  async ({ team_id, status }) => {
    const params = new URLSearchParams();
    if (team_id) params.set("team_id", team_id);
    if (status) params.set("status", status);
    const qs = params.size ? `?${params}` : "";
    const data = await api<unknown>("GET", `/tasks${qs}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

/* ── create_task ────────────────────────────────────────────────── */

server.tool(
  "create_task",
  "Add a single task to a team, optionally assigning it to a member.",
  {
    team_id: z.string().describe("ID of the team this task belongs to"),
    title: z.string().min(1).describe("Task title"),
    description: z.string().optional().describe("Optional longer description"),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    assignee_id: z.string().optional().describe("Member ID to assign the task to"),
    status: z.enum(["backlog", "todo", "in_progress", "done", "cancelled"]).optional().default("backlog"),
  },
  async (args) => {
    const data = await api<unknown>("POST", "/tasks", args);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

/* ── bulk_create_tasks ──────────────────────────────────────────── */

server.tool(
  "bulk_create_tasks",
  "Add many tasks at once — ideal for parsing meeting notes or standups into a full task list.",
  {
    team_id: z.string().describe("Default team for all tasks in this batch"),
    tasks: z
      .array(
        z.object({
          title: z.string().min(1),
          description: z.string().optional(),
          priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
          assignee_id: z.string().optional(),
          status: z.enum(["backlog", "todo", "in_progress", "done", "cancelled"]).optional().default("backlog"),
        })
      )
      .min(1)
      .describe("Array of tasks to create"),
  },
  async ({ team_id, tasks }) => {
    const payload = tasks.map((t) => ({ ...t, team_id }));
    const data = await api<unknown>("POST", "/tasks/bulk", { tasks: payload });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

/* ── create_team ────────────────────────────────────────────────── */

server.tool(
  "create_team",
  "Create a new team in the workspace.",
  {
    name: z.string().min(1).describe("Display name for the team"),
    description: z.string().optional(),
  },
  async (args) => {
    const data = await api<unknown>("POST", "/teams", args);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

/* ── add_member ─────────────────────────────────────────────────── */

server.tool(
  "add_member",
  "Onboard a new teammate with a name and role, optionally added to a team.",
  {
    name: z.string().min(1).describe("Full name of the teammate"),
    role: z.string().optional().describe("Their role or title"),
    team_id: z.string().optional().describe("Team to add them to immediately"),
    email: z.string().email().optional(),
  },
  async (args) => {
    const data = await api<unknown>("POST", "/members", args);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

/* ── boot ───────────────────────────────────────────────────────── */

const transport = new StdioServerTransport();
await server.connect(transport);

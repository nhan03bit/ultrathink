/**
 * Phase-2 cross-agent (team) MCP tools.
 *
 * Registers four tools on a shared McpServer instance:
 *   - memory_share        — save a memory visible to the rest of the team
 *   - memory_team_recall  — recall team-shared memories across agents
 *   - memory_handoff      — structured handoff between two agents
 *   - tekio_team_stats    — aggregate Tekiō adaptations across agents
 *
 * Backend logic lives in `memory/src/team.ts` and `memory/src/team-tekio.ts`.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { shareMemory, teamRecall, handoffMemory, tekioTeamStats } from "../../../packages/memory/src/team.js";

export function registerTeamTools(server: McpServer): void {
  /* ─── memory_share ────────────────────────────────────────────────── */

  server.tool(
    "memory_share",
    "Save a memory visible to the rest of the bipartite team. Auto-tags with PAPERCLIP_AGENT_ID + PAPERCLIP_RUN_ID from env. Stored in wing=knowledge/hall=shared so it stays out of L0–L2 recall but is reachable via memory_team_recall. Use for cross-agent intel that other agents on the team should see.",
    {
      content: z.string().min(20).max(4000).describe("Memory content — what the team should know."),
      title: z.string().min(5).max(80).optional().describe("Optional title; auto-generated if omitted."),
      category: z
        .enum(["decision", "insight", "pattern", "solution", "architecture", "project-context", "workflow-pattern"])
        .optional()
        .default("insight")
        .describe("Memory category (default: insight)."),
      importance: z.number().min(1).max(10).optional().default(6).describe("1-10 importance (default 6)."),
      confidence: z.number().min(0).max(1).optional().default(0.85).describe("0-1 confidence (default 0.85)."),
      tags: z.array(z.string()).optional().describe("Extra tags. 'team-shared' is added automatically."),
      scope: z.string().optional().describe("Project scope filter."),
      agent_id: z.string().optional().describe("Override env-detected PAPERCLIP_AGENT_ID."),
      paperclip_run_id: z.string().optional().describe("Override env-detected PAPERCLIP_RUN_ID."),
    },
    async ({ content, title, category, importance, confidence, tags, scope, agent_id, paperclip_run_id }) => {
      try {
        const memory = await shareMemory({
          content,
          title,
          category,
          importance,
          confidence,
          tags,
          scope,
          agentId: agent_id ?? null,
          paperclipRunId: paperclip_run_id ?? null,
        });

        const agentLabel = (memory as unknown as { agent_id?: string }).agent_id ?? "(no agent)";
        return {
          content: [
            {
              type: "text" as const,
              text: `Team memory shared.\n\nid: ${memory.id}\ntitle: ${memory.title}\nwing: ${memory.wing}/${memory.hall}\nagent: ${agentLabel}\nimportance: ${memory.importance}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to share: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  /* ─── memory_team_recall ──────────────────────────────────────────── */

  server.tool(
    "memory_team_recall",
    "Recall team-shared memories across agents and sessions. Differs from memory_recall (which is layered L0–L3 for the current session) — this is cross-agent, on-demand. Filter by agentId for one agent's shared memories or omit for the entire team.",
    {
      query: z.string().optional().describe("Free-text query (optional). Omit to list latest team memories."),
      agent_id: z.string().optional().describe("Filter to one agent's shared memories."),
      limit: z.number().min(1).max(50).optional().default(15).describe("Max results (default 15)."),
      scope: z.string().optional().describe("Project scope filter."),
      hall: z
        .enum(["shared", "handoff", "all"])
        .optional()
        .default("all")
        .describe("Restrict to shared, handoff, or both (default all)."),
    },
    async ({ query, agent_id, limit, scope, hall }) => {
      try {
        const results = await teamRecall({
          query,
          agentId: agent_id,
          limit,
          scope,
          hall,
        });

        if (results.length === 0) {
          const q = query ? ` for "${query}"` : "";
          return { content: [{ type: "text" as const, text: `No team memories found${q}.` }] };
        }

        const lines = results.map((m, i) => {
          const aid = (m as unknown as { agent_id?: string }).agent_id ?? "(none)";
          const title = m.title || m.content.slice(0, 50);
          const snippet = m.content.length > 140 ? m.content.slice(0, 137) + "..." : m.content;
          return `${i + 1}. [${m.wing}/${m.hall}] **${title}** — agent=${aid}\n   ${snippet}\n   id=${m.id} imp=${m.importance} cat=${m.category}`;
        });

        return {
          content: [{ type: "text" as const, text: `Found ${results.length} team memories:\n\n${lines.join("\n\n")}` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Team recall failed: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  /* ─── memory_handoff ──────────────────────────────────────────────── */

  server.tool(
    "memory_handoff",
    "Structured handoff between two agents. Stores a high-importance memory tagged with agent_id=toAgentId so the target picks it up on their next memory_search/team_recall. Use when transferring an in-flight issue or context to another agent.",
    {
      to_agent_id: z.string().min(1).describe("Target agent id (the receiver)."),
      context: z
        .string()
        .min(20)
        .max(4000)
        .describe("Handoff message — what the target agent needs to know to continue."),
      from_agent_id: z.string().optional().describe("Source agent id; defaults to PAPERCLIP_AGENT_ID env."),
      issue_id: z.string().optional().describe("Optional issue/task id this handoff relates to."),
      importance: z.number().min(1).max(10).optional().default(7).describe("1-10 importance (default 7)."),
      scope: z.string().optional().describe("Project scope filter."),
      paperclip_run_id: z.string().optional().describe("Override env-detected PAPERCLIP_RUN_ID."),
    },
    async ({ to_agent_id, context, from_agent_id, issue_id, importance, scope, paperclip_run_id }) => {
      try {
        const memory = await handoffMemory({
          toAgentId: to_agent_id,
          context,
          fromAgentId: from_agent_id ?? null,
          issueId: issue_id ?? null,
          importance,
          scope,
          paperclipRunId: paperclip_run_id ?? null,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Handoff stored.\n\nid: ${memory.id}\nfrom: ${from_agent_id ?? process.env.PAPERCLIP_AGENT_ID ?? "(unknown)"}\nto: ${to_agent_id}\nissue: ${issue_id ?? "(none)"}\nimportance: ${memory.importance}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Handoff failed: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  /* ─── tekio_team_stats ────────────────────────────────────────────── */

  server.tool(
    "tekio_team_stats",
    "Aggregate Tekiō adaptations across all agents on the team — total active, per-agent counts, top-5 most-applied this month, top-5 most-prevented (defensive value).",
    {},
    async () => {
      try {
        const stats = await tekioTeamStats();

        const perAgentLines = stats.perAgent.length
          ? stats.perAgent.map((r) => `  ${r.agent_id ?? "(no agent)"}: ${r.count}`).join("\n")
          : "  (no per-agent breakdown — adaptations have NULL agent_id)";

        const topAppliedLines = stats.topApplied.length
          ? stats.topApplied
              .map(
                (r, i) =>
                  `  ${i + 1}. [${r.agent_id ?? "shared"}] ${r.trigger_pattern.slice(0, 70)} — applied ${r.times_applied}x`
              )
              .join("\n")
          : "  (none applied in last 30 days)";

        const topPreventedLines = stats.topPrevented.length
          ? stats.topPrevented
              .map(
                (r, i) =>
                  `  ${i + 1}. [${r.agent_id ?? "shared"}] ${r.trigger_pattern.slice(0, 70)} — prevented ${r.times_prevented}x`
              )
              .join("\n")
          : "  (no preventions yet)";

        const text = [
          `☸ Tekiō Team Stats`,
          `Total active adaptations: ${stats.totalActive}`,
          ``,
          `Per agent:`,
          perAgentLines,
          ``,
          `Top 5 most-applied (last 30 days):`,
          topAppliedLines,
          ``,
          `Top 5 most-prevented:`,
          topPreventedLines,
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Tekiō team stats failed: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}

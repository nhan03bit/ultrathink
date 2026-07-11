#!/usr/bin/env node

/**
 * UltraThink Memory MCP Server
 *
 * First-class tools for memory operations:
 * - memory_save: Create memories with required title + metadata
 * - memory_search: Semantic search across all memories
 * - memory_recall: 4-layer brain recall (L0 core → L3 experience)
 * - memory_link: Zettelkasten relation between memories
 * - tekio_status: Wheel stats (adaptations, applications, preventions)
 * - tekio_turn: Manual wheel turn from failure
 *
 * Phase-2 cross-agent (team) tools:
 * - memory_share: Save a memory visible to the rest of the bipartite team
 * - memory_team_recall: Recall team-shared memories across agents/sessions
 * - memory_handoff: Structured handoff between two agents
 * - tekio_team_stats: Aggregate Tekiō adaptations across all agents
 *
 * Required env: DATABASE_URL
 * Optional env (auto-tagged onto team writes): PAPERCLIP_AGENT_ID, PAPERCLIP_RUN_ID
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "dotenv";
import { join } from "path";

// Load .env from project root (two levels up from mcp/memory/dist/)
config({ path: join(import.meta.dirname, "../../../.env") });

// Import memory functions — relative paths to memory workspace source
// These resolve via Node16 module resolution (.js extension → .ts via tsx, or compiled .js)
import { createMemory, semanticSearch, createRelation, getMemory } from "../../../packages/memory/src/memory.js";
import { recall } from "../../../packages/memory/src/recall.js";
import {
  wheelTurn,
  getWheelStats,
  getActiveAdaptations,
  formatAdaptations,
} from "../../../packages/memory/src/adaptation.js";
import { getClient } from "../../../packages/memory/src/client.js";
import { registerTeamTools } from "./team-tools.js";

import type { Wing, MemoryRelationType } from "../../../packages/memory/src/memory.js";

const server = new McpServer({
  name: "memory",
  version: "1.0.0",
});

/* ─── Tool: memory_save ──────────────────────────────────────────── */

server.tool(
  "memory_save",
  "Save a memory to UltraThink's Second Brain. Every memory gets a title, wing/hall placement, and importance score. Use this instead of bash scripts for memory creation.",
  {
    title: z
      .string()
      .min(5)
      .max(80)
      .describe("Short descriptive title (5-80 chars). E.g. 'Decision: Use Vitest over Jest'"),
    content: z
      .string()
      .min(20)
      .max(4000)
      .describe("Memory content — what to remember. Must be human-meaningful, not raw code or errors."),
    category: z
      .enum([
        "identity",
        "preference",
        "style-preference",
        "tool-preference",
        "workflow-pattern",
        "decision",
        "solution",
        "architecture",
        "pattern",
        "insight",
        "project-context",
        "session-summary",
        "correction-log",
        "learning",
      ])
      .describe("Memory category — determines wing/hall placement"),
    tags: z.array(z.string()).optional().describe("Optional tags for search enrichment"),
    importance: z
      .number()
      .min(1)
      .max(10)
      .optional()
      .default(5)
      .describe("1-10 importance (10=core identity, 5=useful, 1=ephemeral)"),
    confidence: z.number().min(0).max(1).optional().default(0.8).describe("0-1 confidence in accuracy"),
    wing: z.enum(["agent", "user", "knowledge", "experience"]).optional().describe("Override auto-inferred wing"),
    hall: z.string().optional().describe("Override auto-inferred hall"),
    scope: z.string().optional().describe("Project scope (e.g. 'ai-agents/ultrathink')"),
  },
  async ({ title, content, category, tags, importance, confidence, wing, hall, scope }) => {
    try {
      const memory = await createMemory({
        title,
        content,
        category,
        tags,
        importance,
        confidence,
        wing: wing as Wing | undefined,
        hall,
        scope,
        source: "mcp",
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Memory saved.\n\nid: ${memory.id}\ntitle: ${memory.title || title}\nwing: ${memory.wing}/${memory.hall}\nlayer: L${memory.layer}\nimportance: ${memory.importance}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Failed to save: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ─── Tool: memory_search ────────────────────────────────────────── */

server.tool(
  "memory_search",
  "Search UltraThink's memory using hybrid semantic search (tsvector + trigram + ILIKE). Returns ranked results with titles, content snippets, and similarity scores.",
  {
    query: z.string().min(2).describe("Search query — natural language or keywords"),
    scope: z.string().optional().describe("Filter by project scope"),
    limit: z.number().min(1).max(30).optional().default(10).describe("Max results (default 10)"),
    min_importance: z.number().min(1).max(10).optional().default(1).describe("Min importance filter"),
  },
  async ({ query, scope, limit, min_importance }) => {
    try {
      const results = await semanticSearch({
        query,
        scope,
        limit,
        minImportance: min_importance,
      });

      if (results.length === 0) {
        return { content: [{ type: "text" as const, text: `No memories found for "${query}"` }] };
      }

      const lines = results.map((m, i) => {
        const sim = m.similarity !== undefined ? ` (${(m.similarity * 100).toFixed(0)}%)` : "";
        const title = m.title || m.content.slice(0, 50);
        const snippet = m.content.length > 120 ? m.content.slice(0, 117) + "..." : m.content;
        return `${i + 1}. [${m.wing}/${m.hall}] **${title}**${sim}\n   ${snippet}\n   id=${m.id} imp=${m.importance} cat=${m.category}`;
      });

      return {
        content: [{ type: "text" as const, text: `Found ${results.length} memories:\n\n${lines.join("\n\n")}` }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Search failed: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ─── Tool: memory_recall ────────────────────────────────────────── */

server.tool(
  "memory_recall",
  "Load UltraThink's 4-layer brain recall — L0 core identity (~100tok), L1 essential decisions (~300tok), L2 context (~500tok). Includes active Tekiō adaptations. Use at session start or when you need full context.",
  {
    scope: z.string().optional().describe("Project scope to filter context-layer memories"),
    compact: z.boolean().optional().default(false).describe("Tighter budget, no headers"),
    aaak: z.boolean().optional().default(false).describe("AAAK lossless compression (~1.5x smaller)"),
    max_tokens: z.number().optional().default(900).describe("Total token budget for L0+L1+L2"),
  },
  async ({ scope, compact, aaak, max_tokens }) => {
    try {
      const result = await recall(scope, {
        compact,
        aaak,
        maxTokens: max_tokens,
        includeAdaptations: true,
      });

      return {
        content: [{ type: "text" as const, text: result || "No memories found." }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Recall failed: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ─── Tool: memory_link ──────────────────────────────────────────── */

server.tool(
  "memory_link",
  "Create a Zettelkasten-style link between two memories. Relations are typed and directional (source → target).",
  {
    source_id: z.string().uuid().describe("Source memory UUID"),
    target_id: z.string().uuid().describe("Target memory UUID"),
    relation: z
      .enum(["learned-from", "contradicts", "supports", "applies-to", "caused-by", "supersedes", "related_to"])
      .describe("Relation type — how source relates to target"),
    strength: z.number().min(0).max(1).optional().default(0.5).describe("Link strength 0-1"),
  },
  async ({ source_id, target_id, relation, strength }) => {
    try {
      await createRelation(source_id, target_id, relation, strength);
      return {
        content: [
          { type: "text" as const, text: `Linked: ${source_id.slice(0, 8)} —[${relation}]→ ${target_id.slice(0, 8)}` },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Link failed: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ─── Tool: tekio_status ─────────────────────────────────────────── */

server.tool(
  "tekio_status",
  "Show Tekiō wheel stats — total adaptations, breakdown by category (defensive/auxiliary/offensive/learning), total applied and prevented counts.",
  {},
  async () => {
    try {
      const sql = getClient();
      const stats = await getWheelStats(sql);
      const adaptations = await getActiveAdaptations(sql);
      const formatted = formatAdaptations(adaptations);

      const summary = [
        `☸ Tekiō Wheel Stats`,
        `Total: ${stats.total} active adaptations`,
        `  Defensive: ${stats.defensive} | Auxiliary: ${stats.auxiliary} | Offensive: ${stats.offensive} | Learning: ${stats.learning}`,
        `  Applied: ${stats.totalApplied}x | Prevented: ${stats.totalPrevented}x`,
      ].join("\n");

      return {
        content: [{ type: "text" as const, text: formatted ? `${summary}\n${formatted}` : summary }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Tekiō error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ─── Tool: tekio_turn ───────────────────────────────────────────── */

server.tool(
  "tekio_turn",
  "Manually trigger a Tekiō wheel turn from a failure. Creates or applies an adaptation. Use when a tool fails and the failure pattern is worth learning from.",
  {
    error: z.string().min(10).describe("Error message from the failure"),
    context: z.string().describe("What was being attempted when the failure occurred"),
    tool: z.string().optional().describe("Tool name that failed (e.g. 'Bash', 'Read', 'Edit')"),
  },
  async ({ error, context, tool }) => {
    try {
      const sql = getClient();
      const result = await wheelTurn(sql, { error, context, tool });

      if (!result) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Wheel skipped — failure filtered as noise (too short, transient, or generic).",
            },
          ],
        };
      }

      const { adaptation, isNew, wheelSpin } = result;
      const status = isNew ? "NEW adaptation forged" : `Existing adaptation applied (${adaptation.times_applied}x)`;

      return {
        content: [
          {
            type: "text" as const,
            text: `☸ ${status} | wheel position: ${wheelSpin}\n\nCategory: ${adaptation.category}\nTrigger: ${adaptation.trigger_pattern}\nRule: ${adaptation.adaptation_rule}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Wheel turn failed: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

/* ─── Phase-2: cross-agent (team) tools ──────────────────────────── */

registerTeamTools(server);

/* ─── Start server ───────────────────────────────────────────────── */

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Memory MCP server failed:", err);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * UltraThink design-doc MCP Server
 *
 * Tools:
 *  - doc_create   → Paperclip upsert (auto-versioned)
 *  - doc_get      → fetch by approved | latest | <revision_number>
 *  - doc_review   → record a lane verdict (code | quality | devops)
 *  - doc_approve  → Director-only seal; requires all 3 lanes = approve
 *
 * Hybrid storage:
 *  - Doc body lives in Paperclip (PUT /api/issues/:id/documents/design-doc)
 *  - Review/approval state machine lives in UltraThink Neon
 *    (design_doc_reviews, design_doc_approvals)
 *
 * Required env: DATABASE_URL, PAPERCLIP_API_URL, PAPERCLIP_API_KEY,
 *               PAPERCLIP_DIRECTOR_AGENT_ID
 *
 * intent: stdio MCP entrypoint, mirror mcp/memory/src/index.ts shape
 * status: done
 * confidence: high
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "dotenv";
import { join } from "path";

import { registerTools } from "./tools.js";

// Load .env from project root (two levels up from mcp/design-doc/dist/)
config({ path: join(import.meta.dirname, "../../../.env") });

const server = new McpServer({
  name: "design-doc",
  version: "1.0.0",
});

registerTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error("design-doc MCP server failed:", e);
  process.exit(1);
});

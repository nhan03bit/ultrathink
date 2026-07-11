# Memory MCP — Team / Cross-Agent Tools (Phase 2)

Adds 4 cross-agent memory primitives on top of the per-session tools (memory_save / search / recall / link / tekio_status / tekio_turn).

Backed by migration `024_agent_attribution.sql` which added `agent_id` + `paperclip_run_id` columns to `memories`, `skill_usage`, `adaptations`.

## Tools

### `memory_share`
Save a memory visible to the rest of the bipartite team. Auto-detects `agent_id` from `process.env.PAPERCLIP_AGENT_ID` if not passed. Sets the `team` scope (or whichever scope semantics `team-tools.ts` uses) so it's findable via `memory_team_recall`.

**When to use**: an agent learns a pattern / decision / piece of context that other agents will benefit from. Examples:
- *Mira [Code Integrator]* discovers a dep-graph rule. Shares so Quinn / Alex / future Mira sessions know.
- *Steven [CEO]* records a strategic decision (architecture preference, vendor selection).
- *Casey [Engineer]* finds an idiom that worked. Shares for next worker.

**Anti-pattern**: don't `memory_share` operational chatter. Reserve for durable, cross-agent-relevant content.

### `memory_team_recall`
Search team-shared memories across agents and sessions. Differs from `memory_recall` (per-session L0-L3) — returns the cross-agent shared knowledge.

**When to use**: at the start of work on a new issue, before relevant decisions, or when asked "what does the team know about X?"

### `memory_handoff`
Structured handoff between two agents. Stores a high-importance memory with `wing=knowledge`, `hall=handoff`, agent_id pointing at the TARGET agent so they pick it up on their next memory recall.

**When to use**: 
- An agent finishes their lane and is passing context to the next reviewer / worker
- Before going `blocked` on another agent's input
- When changing assignment of an issue to a different agent type

**Format**: include the issue ID, what was done, what needs the receiving agent's attention, and any unresolved questions.

### `tekio_team_stats`
Aggregate Tekiō adaptations across the company:
- Active adaptation count overall + per-agent
- Top 5 most-applied this month (proves value)
- Top 5 most-prevented (defensive value)

**When to use**: Director (Steven) periodic review of organizational learning health. Or when an agent wants to see what adaptations are active that affect their work.

## Schema

The 4 tools rely on these columns added by migration `024_agent_attribution.sql`:

```sql
memories.agent_id           TEXT (nullable)
memories.paperclip_run_id   TEXT (nullable)
skill_usage.agent_id        TEXT (nullable)
skill_usage.paperclip_run_id TEXT (nullable)
adaptations.agent_id        TEXT (nullable)
```

Backfill of historical rows is intentionally not attempted — pre-migration rows stay NULL and surface via the v1 ILIKE name fallback in `apps/ut-bridge`.

## Env vars

These are auto-detected from the agent's runtime env (Paperclip exports them):
- `PAPERCLIP_AGENT_ID` — agent UUID
- `PAPERCLIP_RUN_ID` — heartbeat run UUID

## Smoke test

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js | jq '.result.tools[] | .name'
# Expected: 10 tools (6 original + 4 new)
```

## Known issue

`mcp/memory/src/team-tools.ts` imports from `memory/src/team.ts` and `memory/src/team-tekio.ts` (the higher-level package). This crosses tsc's `rootDir` boundary and emits warnings during build. Runtime works because Node resolves the `.js` paths normally. To clean up: either move the team helper code into `mcp/memory/src/` OR adjust tsconfig `rootDir` to the workspace root. Deferred — works as-is.

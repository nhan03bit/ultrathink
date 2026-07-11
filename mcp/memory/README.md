# memory MCP

UltraThink memory exposed as MCP tools (stdio). Backed by Neon Postgres.

Launched via `npx tsx mcp/memory/src/index.ts` (see `.mcp.json`). Required env:
`DATABASE_URL`. Optional env (auto-stamped onto Phase-2 team writes):
`PAPERCLIP_AGENT_ID`, `PAPERCLIP_RUN_ID`.

## Tools (10)

### Session-scoped (Phase-1)

| Tool             | Purpose                                                              |
| ---------------- | -------------------------------------------------------------------- |
| `memory_save`    | Create a memory (title + content + category + wing/hall + importance).|
| `memory_search`  | Hybrid tsvector + pg_trgm + ILIKE semantic search.                   |
| `memory_recall`  | Layered L0–L2 brain recall (current session, ~900 tok budget).       |
| `memory_link`    | Zettelkasten relation between two memories.                          |
| `tekio_status`   | Wheel stats — total, breakdown, applied/prevented counts.            |
| `tekio_turn`     | Manual wheel turn from a failure (creates/applies an adaptation).    |

### Cross-agent (Phase-2 team)

| Tool                 | Purpose                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `memory_share`       | Save a memory visible to the rest of the bipartite team.             |
| `memory_team_recall` | Recall team-shared memories across agents and sessions (on demand).  |
| `memory_handoff`     | Structured handoff between two agents (target picks it up by `agent_id`). |
| `tekio_team_stats`   | Aggregate Tekiō adaptations across agents (per-agent + top-applied/prevented).|

## Phase-2 storage convention

Team memories live in the existing `public.memories` table with these markers:

| Tool             | wing       | hall      | agent_id              | Notes                                |
| ---------------- | ---------- | --------- | --------------------- | ------------------------------------ |
| `memory_share`   | knowledge  | shared    | env (writer)          | Layer 3 — outside L0–L2 recall.      |
| `memory_handoff` | knowledge  | handoff   | `to_agent_id` (target)| Importance ≥7. Metadata in content suffix. |

Why a new hall, not a new scope? `scope` is reserved for project-path filtering
across the codebase; reusing it for a team marker would collide with the existing
recall pipeline. Halls are first-class taxonomy slots, queryable in O(log n) via
the `idx_memories_agent` and the existing wing/hall indexes.

`memory_team_recall` queries `wing='knowledge' AND hall IN ('shared','handoff')`
and accepts an optional `agent_id` filter, so it never bleeds into the standard
session recall budget.

## Examples

```bash
# Share intel with the team (auto-tags PAPERCLIP_AGENT_ID from env)
mcp__memory__memory_share \
  content="Stripe webhooks must be acknowledged within 5s or they retry." \
  importance=7 \
  tags='["stripe","webhooks"]'

# Read what the team has shared
mcp__memory__memory_team_recall query="stripe" limit=5

# Hand off issue #42 from CEO to CTO
mcp__memory__memory_handoff \
  to_agent_id="cto-alice" \
  context="Issue #42 needs schema review — check migrations/025 backwards compat." \
  issue_id="42"

# Inspect cross-agent Tekiō stats
mcp__memory__tekio_team_stats
```

## Migration 024

The Phase-2 tools depend on `agent_id` columns added in
`memory/migrations/024_agent_attribution.sql`:

- `memories.agent_id` (TEXT, indexed)
- `memories.paperclip_run_id` (TEXT, indexed)
- `adaptations.agent_id` (TEXT, indexed)

Already applied — no new migration required.

## Files

- `mcp/memory/src/index.ts` — MCP server entry; registers all tools.
- `mcp/memory/src/team-tools.ts` — Phase-2 tool registrations.
- `memory/src/team.ts` — `shareMemory`, `handoffMemory`, `teamRecall`.
- `memory/src/team-tekio.ts` — `tekioTeamStats`.

The 6 Phase-1 tools and the underlying `createMemory()` signature are
unchanged.

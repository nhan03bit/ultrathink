# @inuverse/ut-bridge

Thin Express bridge between the branded Paperclip UI (port 3100) and UltraThink Neon data.

## Why

Paperclip's server only knows about its own PGlite (issues, agents, runs, etc.).
UltraThink data — memories, skill_usage, Tekiō adaptations, design-doc reviews
— lives in Neon. The branded UI's per-agent panels need both; this bridge
exposes UltraThink data scoped to a Paperclip agent ID, with CORS allowed for
`localhost:3100`.

Default port: **3201**. Override with `UT_BRIDGE_PORT`.

## Endpoints

All endpoints take a Paperclip `agentId` (UUID).

| Method | Path | Source | Filter |
|---|---|---|---|
| GET | `/health` | — | service ping + DB sanity |
| GET | `/agents` | Paperclip API | full list, used internally for resolution |
| GET | `/agents/:agentId/memories?q=&limit=` | `memories` (Neon) | `content / title / search_enrichment ILIKE %name%` |
| GET | `/agents/:agentId/skills?limit=` | `skill_usage` ⨝ `memories.session_id` | sessions where any agent token appears in memory content/title |
| GET | `/agents/:agentId/adaptations?activeOnly=&limit=` | `adaptations` | trigger / rule / source_failure / scope mentions agent name or title |
| GET | `/agents/:agentId/design-docs` | `design_doc_reviews` + `design_doc_approvals` (Neon) | `reviewer_agent_id = :agentId` / `approver_agent_id = :agentId`; issue titles fetched from Paperclip |
| GET | `/agents/:agentId/activity?since=ISO&limit=` | union of memories + adaptations + design-doc reviews | merged and sorted desc by timestamp |

## Caveats (v1)

The `memories`, `skill_usage`, and `adaptations` tables don't yet have an
`agent_id` column. The bridge approximates per-agent scope by matching the
agent's name and title against memory `content`/`title`/`search_enrichment` and
adaptation `trigger_pattern`/`adaptation_rule`/`source_failure`/`scope`.

This is good enough for single-name agents (Steven, Mira, Quinn, Alex, Casey)
because their names rarely collide with general English. Phase-2: add an
`agent_id` column via migration `023_memories_agent_scope.sql` and key on it
directly. Backfill of existing memories is not feasible without re-mining
session transcripts.

`design_doc_reviews` and `design_doc_approvals` *do* carry `reviewer_agent_id`
and `approver_agent_id`, so those endpoints are exact.

Paperclip's own `activity_log` (PGlite) is intentionally NOT joined here. The
UI should hit Paperclip directly for that lens.

## Run

```bash
cd apps/ut-bridge
pnpm install
pnpm tsc -b
node dist/index.js
# or background:
nohup node dist/index.js > /tmp/ut-bridge.log 2>&1 &
```

Requires `DATABASE_URL` in env. Store the real Neon URL in a local, untracked `.env`; committed docs and examples must only use placeholders.

## Smoke test

```bash
curl -sS http://127.0.0.1:3201/health
curl -sS http://127.0.0.1:3201/agents/49da6c47-00e9-4f72-ac8b-0b6e873d4ec8/memories | jq 'length'
curl -sS http://127.0.0.1:3201/agents/49da6c47-00e9-4f72-ac8b-0b6e873d4ec8/skills | jq 'length'
curl -sS http://127.0.0.1:3201/agents/49da6c47-00e9-4f72-ac8b-0b6e873d4ec8/adaptations | jq 'length'
```

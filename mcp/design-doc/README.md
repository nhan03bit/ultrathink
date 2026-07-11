# @ultrathink/mcp-design-doc

MCP server for the **design-doc gate** — the Org-Bench Google-bipartite winning mechanism. Every non-trivial change in an UltraThink project passes through a 4-section structured doc that 3 review lanes (code, quality, devops) sign off on before the Director can seal it. Workers `doc_get` the sealed revision before writing code.

## Tools

| Tool | Purpose |
|---|---|
| `doc_create` | Upsert the design-doc on a Paperclip issue. Pass `baseRevisionId` on subsequent edits for optimistic concurrency. Paperclip auto-increments `revision_number`. |
| `doc_get` | Fetch a revision: `revision: "approved" | "latest" | <number>`. `"approved"` queries `design_doc_approvals` first, then pulls that revision body from Paperclip. |
| `doc_review` | Record a lane verdict (`code` \| `quality` \| `devops`) → `approve` \| `changes-requested` \| `block`. Re-reviews supersede prior rows (audit trail preserved via `superseded_by`). Returns aggregate of all 3 lane verdicts + `readyForApproval` flag. |
| `doc_approve` | **Director-only.** Refuses unless `approverAgentId === PAPERCLIP_DIRECTOR_AGENT_ID` AND all 3 lanes have active `verdict='approve'` on the revision. Idempotent on `(doc, revision)`. |

## Storage architecture (hybrid)

- **Doc body** lives in Paperclip via `PUT /api/issues/:issueId/documents/design-doc`. Body is `JSON.stringify({ what, whatNot, riskGuardrails, verificationSteps })`. Paperclip handles versioning and exposes `revisionNumber` + `currentRevisionId`.
- **Review/approval state** lives in UltraThink Neon — Paperclip's documents schema has no review/approval state machine, so we keep that here:
  - `design_doc_reviews(id, paperclip_doc_id, paperclip_issue_id, paperclip_revision_id, revision_number, lane, verdict, comment, reviewer_agent_id, superseded_by, created_at)`
  - `design_doc_approvals(id, paperclip_doc_id, paperclip_revision_id, approver_agent_id, decision_note, approved_at, UNIQUE(doc, revision))`
- **Recovery denormalization**: every `design_doc_reviews` row carries `paperclip_issue_id` + `revision_number` alongside the UUIDs. If Paperclip is wiped or a company is exported/imported and doc UUIDs change, we can still reattach review history via the `(issue_id, revision_number)` tuple.

## Env vars

| Var | Purpose |
|---|---|
| `DATABASE_URL` | UltraThink Neon connection string (required). |
| `PAPERCLIP_API_URL` | Paperclip base URL. Default `http://127.0.0.1:3100`. |
| `PAPERCLIP_API_KEY` | Optional bearer token for Paperclip API. |
| `PAPERCLIP_DIRECTOR_AGENT_ID` | UUID of the Director agent. `doc_approve` rejects any other approver. |

## Build

```bash
cd mcp/design-doc
npm install
npx tsc          # → dist/
npm start        # node dist/index.js (stdio MCP)
```

Schema migration: `memory/migrations/020_design_doc_reviews.sql` — apply with `psql "$DATABASE_URL" -f memory/migrations/020_design_doc_reviews.sql`.

Registered in `.mcp.json` as `"design-doc"`.

# UltraThink — Gemini Agent Instructions

> 4-layer skill mesh, persistent memory, privacy hooks, observability dashboard.

## Identity

You are **UltraThink** — an intelligent agent with structured skills, persistent memory,
and a layered architecture for complex engineering tasks. Not a chatbot.

## Tech Stack

- **Dashboard**: Next.js 15 + Tailwind v4 (port 3333)
- **Database**: Neon Postgres + pgvector + pg_trgm
- **Skills**: 125 across 4 layers (8 orchestrator, 18 hub, 35 utility, 64 domain)
- **Memory**: Postgres-backed Second Brain with 4-wing architecture
- **Tools**: VFS (AST signatures) via MCP
- **Search**: Hybrid tsvector + pg_trgm + ILIKE with synonym expansion

## VFS — Mandatory for Code Exploration

**ALWAYS use VFS before reading files.** VFS returns function/class signatures without bodies (60-98% token savings). Only read specific line ranges after you know what you need.

## Skill Mesh

4 layers: **Orchestrators** → **Hubs** → **Utilities** → **Domain Specialists**.
Skills live in `.claude/skills/[name]/SKILL.md`. Registry at `.claude/skills/_registry.json`.
When a task matches a skill's triggers, read and follow its `SKILL.md`.

## Memory (Second Brain)

- **4-wing structure**: agent (WHO I am) | user (WHO you are) | knowledge (WHAT learned) | experience (WHAT happened)
- **Wing/hall**: `agent/{core,rules,skills}` | `user/{profile,preferences,projects}` | `knowledge/{decisions,patterns,insights,reference}` | `experience/{sessions,outcomes,errors}`
- **4-layer recall**: L0 core (~100tok) → L1 essential (~300tok) → L2 context (~500tok) → L3 on-demand
- **Zettelkasten linking**: Relations typed as `learned-from | contradicts | supports | applies-to | caused-by | supersedes`
- **AAAK**: Lossless shorthand dialect for ~1.5x compression on recall output

### Memory Commands

```bash
npx tsx memory/scripts/memory-runner.ts session-start  # Load context
npx tsx memory/scripts/memory-runner.ts search "query"  # Search memories
npx tsx memory/scripts/memory-runner.ts save "content" "category" importance
npx tsx memory/scripts/memory-runner.ts flush            # Flush pending
```

### Obsidian Vault

- Vault path: `~/.ultrathink/vault/` — 4-wing structure with MOC files and backlinks
- CLI: `npx tsx scripts/vault-sync.ts <vault-to-db|db-to-vault|rebuild>`

## Key Paths

| Area | Path |
|------|------|
| Skills | `.claude/skills/[name]/SKILL.md` |
| References | `.claude/references/*.md` |
| Memory | `memory/` |
| Dashboard | `dashboard/` |

## Code Standards

- TypeScript strict mode, no `any`
- React: functional components, hooks, server components where possible
- CSS: Tailwind v4 with CSS custom properties for design tokens
- SQL: Parameterized queries only, no string interpolation
- Tests: Vitest for unit
- Git: Conventional commits, no force push

## References (read on demand)

- `core.md` — Response patterns, skill selection, error handling
- `memory.md` — Memory read/write discipline
- `privacy.md` — File access control, sensitivity levels
- `quality.md` — Code standards, review checklist
- `teaching.md` — Coding level adaptation (beginner→expert)

## Key Skills

| Task | Skill | Trigger |
|------|-------|---------|
| Build a feature | `gsd` | "build", "implement" |
| Debug an issue | `debug` | "fix this", "why is" |
| Write tests | `test` | "write tests" |
| Plan architecture | `plan` | "how should we" |
| UI design | `ui-design-pipeline` | "design a page" |
| Code review | `code-review` | "review this" |
| Optimize perf | `optimize` | "make it faster" |

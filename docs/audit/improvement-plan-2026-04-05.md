# UltraThink Improvement Plan — 2026-04-05 (Two-Tier Edition)

> Actionable roadmap for **UltraThink Core** (private) and **UltraThink OSS** (public)
> as a single product shipped in two tiers. Derived from `audit-2026-04-05.md`.
> Complexity: **S** <1 hr · **M** 1-4 hr · **L** 1-3 days · **XL** multi-week.
> Tier tags: **[CORE]** · **[OSS]** · **[BOTH]** · **[SHARED]** (the byte-identical layer).

---

## 1. North Star

**Make UltraThink the best Claude Workflow OS — as a healthy private Core backed by a credible, installable OSS subset that stays in sync.**

"Best" now means two things simultaneously:

1. **Core is a complete, trustworthy workflow engine** — every subsystem (skill mesh, memory, code-intel, Tekiō, hooks, dashboard) works, is tested, and is observable.
2. **OSS is a credible open-source product** — installs from a clean clone, claims only what it delivers, and stays in sync with Core on the shared layer.

The product is **one UltraThink** — Core is the complete kit, OSS is the public shell. Neither is a rebrand, neither is a fork.

---

## 2. Strategic Pillars

| # | Pillar | One-line |
|---|--------|----------|
| 1 | **Identity Coherence** | Both tiers' docs tell the truth. Core stops claiming Superpowers is merged; OSS stops claiming "125+ skills" when there are 388. |
| 2 | **Core/OSS Parity Discipline** | A mechanical guarantee — scripts, CI checks, and a tier manifest — that the shared layer stays byte-identical and deltas are explicit. |
| 3 | **Subsystem Quality** | Tests, observability, and maintainability for every subsystem on both sides of the tier boundary. |
| 4 | **Trust** | Secrets never leak. `/tmp` is 0600. Dashboard routes authenticated. Public README matches reality. |
| 5 | **Integration + Observability** | Memory, skills, Tekiō (Core), and code-intel (Core) compose into one runtime; the dashboard makes every subsystem visible. |

---

## 3. What Stays Private (the Core-only manifest)

These never ship to OSS. This list is **authoritative** — the parity check in Phase 1 enforces it.

| Artifact | Reason |
|----------|--------|
| `code-intel/` entire workspace (5 MCP tools, indexer, query engine, clusterer) | Strategic moat |
| `memory/src/adaptation.ts` — Tekiō Cycle of Nova | Strategic moat |
| `memory/scripts/identity.ts` — identity graph runner | Research-grade, not stable |
| `memory/scripts/wheel-count.ts`, `seed-adaptations.ts` | Tekiō tooling |
| `memory/scripts/archive-bad-identity.ts`, `archive-bad-prefs.ts`, `archive-failures.ts`, `re-enrich-all.ts` | Core ops only |
| `.claude/hooks/codeintel-session-check.sh`, `post-edit-codeintel.sh` | Code-intel lifecycle |
| `.claude/hooks/tool-failure-log.sh` | Tekiō wheel-turn driver |
| `.claude/hooks/decision-engine.ts`, `.claude/hooks/reports/` | Internal tooling |
| MCP servers: `agora`, `code-intel`, `vibecli`, `stitch` | Non-portable / business-specific |
| Core CLAUDE.md sections referencing code-intel, Tekiō, GSD-internal specifics | Above the OSS surface |
| `AUDIT-*.md` and internal audit notes | Internal documents |

**Everything else is shared.** New Core work defaults to shared unless explicitly added to this list.

---

## 4. What OSS Must Do to Be Credible

A new developer clones `github.com/InuVerse/ultrathink`, reads `README.md`, runs `./scripts/setup.sh`, starts Claude Code, and everything works as advertised. Today that is not true. These are the minimum bars:

| # | Requirement | Current State | Task |
|---|-------------|---------------|------|
| 1 | README skill-count matches reality | "125+" (false; actual 388) | QW-9 |
| 2 | CLAUDE.md skill-count matches reality | "370+" (still wrong) | QW-9 |
| 3 | `package.json` workspaces reflect actual directories | lists `code-intel` (absent) | QW-10 |
| 4 | `npm install` succeeds on clean clone | unknown (likely broken due to workspace) | QW-10 + P1-11 |
| 5 | `./scripts/setup.sh` smoke-tested end-to-end | uncertain | P1-11 |
| 6 | `memory-runner.ts` only exposes commands whose code exists | unknown — may advertise Tekiō commands | P1-12 |
| 7 | Documented quickstart that actually produces a working dashboard | exists in README but not verified | P1-11 |
| 8 | Public changelog / release notes | absent | P3-OSS-1 |
| 9 | CI runs on every PR | unknown | P2-OSS-1 |
| 10 | License clarity (MIT) visible on every public doc | `LICENSE` exists, OK | done |

---

## 5. Phased Roadmap

### Phase 1 — Stop the Bleeding (1-2 days)

Tier tag on every task. Quick Wins (QW-*) have copy-paste code in Section 6.

| ID | Tier | Task | Pillar | Effort | Ref |
|----|:----:|------|--------|:------:|-----|
| P1-1 | [BOTH] | ~~Block `.env` in `memory-auto-save.sh`~~ **ALREADY DONE** — verified at line 72 in both tiers | Trust | — | Correction |
| P1-2 | [BOTH] | `umask 077` in every hook that writes `/tmp/ultrathink-*` | Trust | S | S-22 |
| P1-3 | [CORE] | Delete Superpowers section from Core `CLAUDE.md:38-49` + rewrite `CREDITS.md:14-18` row | Identity | S | C-1, C-2 |
| P1-4 | [CORE] | Remove dangling `autonomous-loops → subagent-driven-development` edge | Identity | S | C-3 |
| P1-5 | [CORE] | Fix `wheelSpin` cumulative counter | Subsystem | S | C-4 |
| P1-6 | [BOTH] | Add DB probe to `/api/health` (S-3) | Observability | S | S-3 |
| P1-7 | [CORE] | Archive `AUDIT-2026-03-27.md` into `docs/audit/archive/` with status header | Trust | S | C-9 |
| P1-8 | [CORE] | Resolve `ut-chain` (wire or delete) | Identity | S | C-11 |
| P1-9 | [OSS] | **QW-9** Fix README.md + CLAUDE.md skill count to match registry (388) | Identity | S | O-1, O-2 |
| P1-10 | [OSS] | **QW-10** Remove `code-intel` from `package.json` workspaces + delete `codeintel:*` scripts | Identity/Trust | S | O-3, O-4 |
| P1-11 | [OSS] | Smoke-test `./scripts/setup.sh` from a clean clone; document + fix failures | Trust | M | O-5 |
| P1-12 | [OSS] | Audit `memory/scripts/memory-runner.ts` — remove or stub any command whose implementation was stripped (identity, wheel-*) | Trust | M | O-6 |
| P1-13 | [BOTH] | Dashboard middleware coverage audit — which of 31 routes are authenticated? | Trust | M | S-7 |
| P1-14 | [SHARED] | **Create `scripts/parity-check.sh`** — asserts byte-identity on the shared-file manifest; fails CI on drift | Parity | M | DR-4 |
| P1-15 | [SHARED] | **Create `docs/TIER-MANIFEST.md`** — canonical list of what's shared, what's Core-only, what's OSS-only | Parity | S | DR-3 |

**Phase 1 total effort**: ~1.5 days solo. Both tiers pass a first-impression check. Parity is now mechanically enforced.

### Phase 2 — Strengthen Foundations (1-2 weeks)

| ID | Tier | Task | Pillar | Effort | Ref |
|----|:----:|------|--------|:------:|-----|
| P2-1 | [BOTH] | Re-verify the 117 unresolved findings from `AUDIT-2026-03-27.md` | Trust | L | legacy |
| P2-2 | [SHARED] | Stand up vitest infra (Neon branch per CI or pg-mem fallback) for `memory/`, `code-intel/` (Core-only suite), shared hooks | Subsystem | M | S-2 |
| P2-3 | [SHARED] | Test suite for `memory/src/memory.ts` — CRUD, tags, null semantics, ILIKE escape | Subsystem | M | S-4, S-5 |
| P2-4 | [CORE] | Test suite for `memory/src/adaptation.ts` — wheelTurn/wheelLearn/wheelSpin cumulative | Subsystem | M | C-4 |
| P2-5 | [CORE] | Test suite for `code-intel/src/query.ts` — cycle safety, name collisions, impact correctness | Subsystem | M | C-7, C-8 |
| P2-6 | [SHARED] | Dashboard API smoke tests (one per route × 31) | Subsystem | L | S-7..S-11 |
| P2-7 | [SHARED] | OpenAPI 3.1 spec generation + `dashboard/app/api/README.md` | Observability | M | S-19 |
| P2-8 | [SHARED] | Auth middleware enforcement on every non-public route | Trust | L | S-7 |
| P2-9 | [SHARED] | Fix `updateMemory()` null semantics | Subsystem | M | S-4 |
| P2-10 | [SHARED] | Fix double-flush between `memory-session-end.sh:50` and `memory-runner.ts:283` | Integration | M | S-12 |
| P2-11 | [SHARED] | ILIKE wildcard escape for raw user input | Trust | S | S-5 |
| P2-12 | [CORE] | Fix `tool-failure-log.sh:113` stderr/stdout swap | Subsystem | S | C-5 |
| P2-13 | [SHARED] | Rate limit `/api/agora/token` + size limits on `/api/ai/chat` | Trust | M | S-10, S-11 |
| P2-14 | [SHARED] | Fix auto-memory pipeline data-loss: don't delete files on DB failure | Trust | M | S-20, S-21 |
| P2-15 | [OSS] | Public CI (GitHub Actions): lint + test + parity-check + setup-smoke | Trust | M | new |
| P2-16 | [OSS] | `CHANGELOG.md` + semver tags for the public subset | Identity | S | OSS-7 |

**Phase 2 total**: ~8-12 engineer-days. Both tiers have a test safety net, documented APIs, public CI, and the shared-layer invariant is machine-checked on every PR.

### Phase 3 — Polish & Elevate (1 month)

| ID | Tier | Task | Pillar | Effort | Ref |
|----|:----:|------|--------|:------:|-----|
| P3-1 | [SHARED] | Modularize `prompt-analyzer.ts` (1929 LOC) into `prompt-analyzer/{index,registry,triggers,scoring,intent,graph,preferences,session,planning,types}.ts` — **with an adapter boundary so Tekiō (Core) and code-intel (Core) can plug in without modifying shared files** | Parity + Subsystem | L | S-1, DR-1 |
| P3-2 | [CORE] | Wire 6 orphan skills; resolve broken SM links | Identity | S | SM-3 |
| P3-3 | [SHARED] | Graph-validation pre-commit hook — rejects broken links, missing SKILL.md, parity drift | Trust | M | DR-4 |
| P3-4 | [BOTH] | Consolidate repo-root identity files (Core has 7+; OSS has 4) | Identity | S | C-10 |
| P3-5 | [SHARED] | Fix macOS-only shell idioms (`tail -r`, `stat -f%m`) for Linux | Subsystem | S | S-15 |
| P3-6 | [SHARED] | Fix Kanban mobile grid + command palette ARIA/focus trap | Subsystem | M | S-16, S-17 |
| P3-7 | [SHARED] | Analytics range param fix | Subsystem | S | S-18 |
| P3-8 | [SHARED] | Compact migrations 010, 013, 014 (fix-up migrations) into clean baseline | Subsystem | M | — |
| P3-9 | [OSS] | Public `docs/site/` — docs landing page, live dashboard screenshots, skill browser | Identity | M | OSS-credibility |
| P3-10 | [OSS] | Publishable installer script with verification: `./scripts/verify-install.sh` | Trust | M | O-5 |

**Phase 3 total**: ~2-3 weeks. Both tiers are maintainable; the prompt-analyzer is adapter-based so Core can extend it without breaking OSS parity.

### Phase 4 — The UltraThink Vision (strategic, ongoing)

| ID | Tier | Initiative | Pillar | Effort |
|----|:----:|------------|--------|:------:|
| P4-1 | [CORE] | **Tekiō Insights Dashboard** — wheel state, adaptations, success clusters, failure clusters. Core-only dashboard page (feature-flagged). | Observability + Innovation | L |
| P4-2 | [BOTH] | **Skill Mesh Visualizer** — force-directed graph of the 388/393 skills, activation heat, layer coloring. Ships to OSS as the signature visual. | Identity + Observability | L |
| P4-3 | [BOTH] | **Memory-Driven Prompt Augmentation** — recall informs skill scoring. Shared, cheap, high impact. | Integration | L |
| P4-4 | [CORE] | **GSD v2 with Tekiō learning** — GSD outcomes feed the wheel; next plan avoids past mistakes. Core-only because Tekiō is Core-only. | Integration + Innovation | XL |
| P4-5 | [CORE] | **Identity Graph Query UI** — browse nodes/edges, approve conflicts | Observability | L |
| P4-6 | [BOTH] | **Prompt-Analyzer Explanation Mode** — "why was this skill injected?" — runs on shared analyzer | Observability | M |
| P4-7 | [SHARED] | **Hooks Runtime to TypeScript** — replace shell scripts with typed TS modules. Shared migration path benefits both tiers. | Subsystem | XL |
| P4-8 | [OSS] | **Public Superpowers integration (if desired)** — author the 8 skills properly and ship to OSS. Or formally remove the aspiration. | Identity | L |

---

## 6. Quick Wins — Copy-Paste (<1 hour each)

### QW-1 — Archive the stale `memory-auto-save.sh` concern [BOTH] (5 min)

Previous audits flagged line 71 as a credential leak. **Verified false.** Add a status note to the audit archive and move on. No code change needed.

### QW-2 — Umask on `/tmp` hooks [BOTH] (10 min)

Every hook that writes to `/tmp/ultrathink-*` gets this as the first executable line after `set -euo pipefail`:

```bash
umask 077  # UltraThink: restrict temp files to owner only
```

**Acceptance**: `ls -la /tmp/ultrathink-*` shows `-rw-------`.

### QW-3 — Reconcile Superpowers in Core [CORE] (20 min)

**File**: `CLAUDE.md` lines 38-49 — delete the entire `### Superpowers Integration (Always-On)` block. Replace with:

```markdown
### Execution Methodologies
UltraThink ships with **GSD** as its built-in workflow methodology (gsd, gsd-plan,
gsd-execute, gsd-verify). GSD is an internal subsystem. Additional methodologies
may be integrated as optional skill packs in future releases.
```

**File**: `CREDITS.md:14-18` — rewrite Superpowers row as:

```markdown
| **obra/superpowers** | MIT | Inspirational reference for UltraThink's GSD methodology. Not currently integrated. | [github.com/obra/superpowers](https://github.com/obra/superpowers) |
```

### QW-4 — Remove dangling graph edge [CORE] (5 min)

`.claude/skills/_registry.json` — find the `autonomous-loops` entry, remove `"subagent-driven-development"` from its `linksTo` array.

### QW-5 — Fix `wheelSpin` cumulative counter [CORE] (20 min)

`memory/src/adaptation.ts` at lines 316, 353, 538 — remove the `WHERE is_active = true` clause:

```typescript
const [{ count }] = await sql`SELECT COUNT(*) as count FROM adaptations`;
```

### QW-6 — DB probe in `/api/health` [BOTH] (15 min)

`dashboard/app/api/health/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const started = Date.now();
  try {
    const sql = getDb();
    await sql`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "ok", latency_ms: Date.now() - started });
  } catch (err) {
    return NextResponse.json({ status: "degraded", db: "down", error: String(err) }, { status: 503 });
  }
}
```

Ship the **same file** to both tiers (it's in the shared layer).

### QW-7 — Archive stale Core audit [CORE] (5 min)

```bash
mkdir -p docs/audit/archive
mv AUDIT-2026-03-27.md docs/audit/archive/
```

### QW-8 — Resolve `ut-chain` orphan [CORE] (10 min)

Read `.claude/skills/ut-chain/SKILL.md`. Either wire ≥2 `linksTo` edges and ≥1 `linkedFrom`, or delete the directory and registry entry.

### QW-9 — Fix OSS skill-count claims [OSS] (10 min)

```bash
# Get truth
jq '.skills | length' /path/to/ultrathink-oss/.claude/skills/_registry.json
# → 388
```

**Edit** `ultrathink-oss/README.md` lines 40 and 152: change every `125+` to `388+`.
**Edit** `ultrathink-oss/CLAUDE.md` line 14: change `370+` to `388+`.

**Better long-term**: replace hard-coded numbers with a generated badge sourced from `_registry.json` at build time (SI-OSS-1).

### QW-10 — Remove phantom `code-intel` workspace [OSS] (5 min)

`ultrathink-oss/package.json`:
- Line 10: remove `"code-intel"` from `workspaces`.
- Lines 27-28: remove `codeintel:build` and `codeintel:index` scripts.

Run `npm install` in a clean clone to confirm it succeeds.

### QW-11 — Parity check script [SHARED] (30 min)

New file: `scripts/parity-check.sh` at **Core repo root**:

```bash
#!/usr/bin/env bash
# UltraThink Core/OSS parity check.
# Asserts that shared-layer files are byte-identical between the two repos.
set -euo pipefail
CORE="${CORE_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
OSS="${OSS_DIR:-$CORE/../ultrathink-oss}"

if [ ! -d "$OSS" ]; then
  echo "OSS repo not found at $OSS; skipping parity check."
  exit 0
fi

SHARED_FILES=(
  ".claude/hooks/memory-auto-save.sh"
  ".claude/hooks/memory-session-start.sh"
  ".claude/hooks/memory-session-end.sh"
  ".claude/hooks/privacy-hook.sh"
  ".claude/hooks/prompt-analyzer.ts"
  ".claude/hooks/prompt-submit.sh"
  "memory/src/memory.ts"
  "memory/src/enrich.ts"
  "memory/src/hooks.ts"
  "memory/src/plans.ts"
  "memory/src/analytics.ts"
  "memory/src/client.ts"
  # migrations handled separately below
)

fail=0
for f in "${SHARED_FILES[@]}"; do
  if ! diff -q "$CORE/$f" "$OSS/$f" >/dev/null 2>&1; then
    echo "DRIFT: $f"
    fail=1
  fi
done

# Migrations: same filenames + same contents
for m in "$CORE/memory/migrations/"*.sql; do
  base="$(basename "$m")"
  if ! diff -q "$m" "$OSS/memory/migrations/$base" >/dev/null 2>&1; then
    echo "DRIFT: memory/migrations/$base"
    fail=1
  fi
done

if [ $fail -eq 0 ]; then
  echo "Core/OSS parity OK."
else
  echo "Parity check FAILED."
  exit 1
fi
```

Run it before every release on both sides. Add as a GitHub Action in P2-OSS-1.

### QW-12 — Tier manifest doc [SHARED] (15 min)

Create `docs/TIER-MANIFEST.md` at Core repo root. Content:

```markdown
# UltraThink Tier Manifest

Canonical boundary between **UltraThink Core** (private) and **UltraThink OSS** (public, MIT).

## Core-only (never ship to OSS)
- code-intel/ (entire workspace, 5 MCP tools)
- memory/src/adaptation.ts (Tekiō)
- memory/scripts/{identity,wheel-count,seed-adaptations,archive-*,re-enrich-all}.ts
- .claude/hooks/{codeintel-session-check,post-edit-codeintel,tool-failure-log}.sh
- .claude/hooks/decision-engine.ts, .claude/hooks/reports/
- MCP servers: agora, code-intel, vibecli, stitch
- AUDIT-*.md, docs/audit/ internals

## OSS-only (public surface)
- scripts/setup.sh, init-global.sh, sync-editors.sh
- README.md banner, quickstart, badges
- LICENSE (MIT), CONTRIBUTING.md, CHANGELOG.md

## Shared (byte-identical required; enforced by scripts/parity-check.sh)
- .claude/hooks/ (minus Core-only list)
- memory/src/ (minus adaptation.ts)
- memory/migrations/*
- .claude/skills/_registry.json entries for the shared skill set
- dashboard/ (entire)
- tests/
- prompt-analyzer.ts (with adapter boundary — see P3-1)

## Backport rule
Any change to a shared file must land in both repos before the next release.
Parity check gates CI on both sides.
```

---

## 7. Strategic Initiatives (detailed)

### SI-1 — Core/OSS Parity Mechanism [SHARED, L]

**Goal**: Parity discipline becomes mechanical, not manual.

**Components**:
1. `scripts/parity-check.sh` (QW-11) run on every PR in both repos.
2. `docs/TIER-MANIFEST.md` (QW-12) as the canonical boundary.
3. A `release.sh` script that verifies parity, tags a version on Core, and produces a patch set for OSS.
4. Shared CI workflow imported into both repos.

**Acceptance**: `npm run parity` on Core passes when OSS matches; fails with a clear diff list when it doesn't.

### SI-2 — Vitest Infrastructure + First 3 Suites [SHARED, L]

Same as before: `memory.ts`, `adaptation.ts` (Core-only), `query.ts` (Core-only). Shared tests live in both repos; Core-only tests live only in Core. Parity check exempts `tests/core-only/`.

### SI-3 — Prompt-Analyzer Modularization with Adapter Boundary [SHARED, L]

**Critical**: this is the drift bomb from DR-1. The refactor is mandatory **and** must produce an adapter API so Core can inject Tekiō and code-intel scoring hooks without touching shared code.

**Target**:
```
.claude/hooks/prompt-analyzer/
  index.ts           # shared entry point
  registry.ts
  triggers.ts
  scoring.ts         # accepts scoring adapters via registry
  intent.ts
  graph.ts
  preferences.ts
  session.ts
  planning.ts
  types.ts
  adapters/
    index.ts         # adapter registry (empty in OSS)
```

In Core, a parallel directory `.claude/hooks/prompt-analyzer-core/` provides:
- `tekio-adapter.ts` — injects adaptation rules
- `codeintel-adapter.ts` — boosts code-intel-aware skills

Core's runtime wires these into the adapter registry at module load. OSS's runtime sees an empty registry and behaves identically to today.

**Acceptance**: parity check passes; Core exercises Tekiō scoring; OSS doesn't import any Core-only module.

### SI-4 — Dashboard API Surface [SHARED, L]

OpenAPI 3.1 + Swagger UI + `dashboard/app/api/README.md` + auth classification + rate limits on all 31 routes. Ships identically to both tiers.

### SI-5 — Tekiō Insights Dashboard [CORE, L]

Core-only page, feature-flagged. When `ADAPTATION_ENABLED=false` (OSS default), the page 404s gracefully.

### SI-6 — Skill Mesh Visualizer [BOTH, L]

Force-directed graph. The **signature** UltraThink visual. Ships to OSS as a flagship feature that justifies the open-source release.

### SI-7 — OSS Public CI [OSS, M]

GitHub Actions workflow: lint, typecheck, test, parity-check, setup.sh smoke test, skill-count assertion.

### SI-8 — OSS Changelog + Semver Release Discipline [OSS, S]

Every parity-clean backport produces a tagged release on OSS. `CHANGELOG.md` at repo root.

---

## 8. Identity & Positioning Decisions

### Decision 1: Two-tier model is canonical
UltraThink is one product shipped in two tiers. **Not** a fork, **not** a rebrand, **not** two products. Every doc and roadmap assumes this.

### Decision 2: Core stays private; OSS is the gift
Core is where innovation happens first (Tekiō, code-intel, identity graph, proprietary skills). OSS gets the curated, stable, MIT-licensed subset. No gating of the memory or skill systems — those are always shared.

### Decision 3: Parity is mechanical, not social
The `scripts/parity-check.sh` + tier manifest are authoritative. Human memory cannot keep two repos in sync across months.

### Decision 4: OSS public claims must be literally true
Every number, feature, and screenshot in the OSS README is provable from the repo. No "125+" when there are 388. No "code-intel workspace" when there isn't one. First impressions are the entire game for an open-source project.

### Decision 5: Superpowers is not part of UltraThink's identity
Remove the claim from Core. GSD is the built-in methodology. Superpowers can be added later as a proper skill pack (P4-8) or not at all. Either way, it does not define the product.

### Decision 6: Tekiō is the crown jewel of Core
Tekiō is what makes Core worth keeping private. The Core roadmap prioritizes Tekiō visibility (P4-1), Tekiō + GSD integration (P4-4), and Tekiō-aware scoring (SI-3 adapter). OSS users see skill mesh + memory; Core users see skill mesh + memory + adaptation.

---

## 9. ROI Ranking

| Rank | Task | Tier | Effort | Impact |
|:---:|------|:----:|:------:|:------:|
| 1 | QW-9 OSS skill-count truth | OSS | S | Critical (credibility) |
| 2 | QW-10 Remove phantom code-intel workspace | OSS | S | Critical (installability) |
| 3 | QW-11 + QW-12 Parity check + tier manifest | SHARED | M | Critical (future-proof) |
| 4 | QW-3 Reconcile Superpowers docs | CORE | S | Critical (identity) |
| 5 | QW-2 /tmp umask 077 | BOTH | S | Critical (secrets on disk) |
| 6 | QW-5 wheelSpin cumulative | CORE | S | High (Tekiō correctness) |
| 7 | P1-11 OSS setup.sh smoke test | OSS | M | High (installability) |
| 8 | QW-6 DB probe in /api/health | BOTH | S | High |
| 9 | P1-13 Dashboard auth audit | BOTH | M | Critical |
| 10 | P2-14 Auto-memory data-loss fix | BOTH | M | Critical |
| 11 | SI-2 Vitest + 3 test suites | BOTH | L | High |
| 12 | P2-1 Re-verify 2026-03-27 | BOTH | L | High |
| 13 | SI-3 Prompt-analyzer with adapter boundary | SHARED | L | Very High (parity) |
| 14 | SI-4 OpenAPI + API README | BOTH | M | Medium |
| 15 | P2-15 OSS public CI | OSS | M | High |
| 16 | P4-1 Tekiō Insights Dashboard | CORE | L | High (Core identity) |
| 17 | P4-2 Skill Mesh Visualizer | BOTH | L | High (strategic) |
| 18 | P4-3 Memory-driven prompt augmentation | BOTH | L | High (strategic) |
| 19 | P4-4 GSD v2 with Tekiō | CORE | XL | Very High (Core moat) |

---

## 10. Acceptance — "UltraThink is healthy" (two-tier definition)

UltraThink is healthy when **all** of the following hold:

### Core health
1. Every claim in Core `CLAUDE.md` and `CREDITS.md` is demonstrably true. No Superpowers fiction.
2. Tekiō: `wheelSpin` cumulative, learning inserts work, adaptations survive compaction, dashboard page exists.
3. Code-intel: cycle safety tested, name-collision handled, 5 MCP tools documented.
4. `memory/src/{memory,adaptation,enrich}.ts` ≥75% test coverage.

### OSS health
5. `README.md` and `CLAUDE.md` skill counts match `_registry.json` exactly.
6. `npm install` succeeds on a clean clone. `./scripts/setup.sh` runs end-to-end.
7. Public CI green on every PR.
8. `CHANGELOG.md` maintained; semver tags pushed.
9. No references to subsystems that aren't in the OSS tree.

### Shared health
10. Every file in the shared manifest byte-identical between tiers (parity-check.sh green).
11. `prompt-analyzer.ts` refactored with adapter boundary; Core extends via adapters only.
12. Dashboard: all 31 routes authenticated, documented (OpenAPI), rate-limited where appropriate.
13. `/api/health` probes DB. `/tmp/ultrathink-*` 0600. No secrets captured.
14. ≥20 test files across both tiers, ≥60% coverage on shared TypeScript sources.
15. `docs/TIER-MANIFEST.md` current.

**Target scores after Phase 3**:
- Core: **85 / 100**
- OSS: **82 / 100**
- Shared: **88 / 100**

After Phase 4 strategic initiatives: **90+** on all three.

---

## 11. Execution Order — Month 1

| Day | Tasks | Outcome |
|-----|-------|---------|
| 1 AM | QW-9, QW-10, QW-11, QW-12 | OSS honest, parity mechanized |
| 1 PM | QW-2, QW-3, QW-4, QW-5, QW-6, QW-7, QW-8 | Core bleed stopped, docs reconciled |
| 2 | P1-11 (setup.sh smoke), P1-12 (memory-runner audit) | OSS installable from clean clone |
| 3 | P1-13 (dashboard auth audit) | Security posture known on both tiers |
| 4-6 | SI-2 vitest infra + memory/adaptation tests | Safety net live |
| 7-9 | P2-1 2026-03-27 re-verification | Audit drift closed |
| 10-14 | P2-6 API smoke tests + SI-4 OpenAPI | Dashboard documented + covered |
| 15-20 | SI-3 prompt-analyzer modularization with adapter boundary | Parity bomb defused |
| 21-25 | Phase 3 polish (orphans, Kanban, ARIA, analytics range) | UltraThink healthy |
| 26-30 | P2-15 OSS public CI + P2-16 CHANGELOG + first tagged release | OSS publicly credible |

**End of month 1**: Core ≥85, OSS ≥82, shared ≥88. Parity is mechanical. OSS is installable and truthful. Core has tests. Superpowers fiction is gone.

**Month 2+**: Phase 4 strategic initiatives — Tekiō dashboard (Core), Skill Mesh Visualizer (both), GSD v2 with Tekiō (Core), adapter-based memory-driven prompt augmentation. UltraThink becomes the Claude Workflow OS it was always meant to be — in both tiers.

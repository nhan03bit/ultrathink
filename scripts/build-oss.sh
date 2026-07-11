#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# UltraThink OSS Builder
# Creates a clean open-source package at ../ultrathink-oss/
# Strips: Tekio, identity graph, decision engine, code-intel,
#          advanced skills, Agora voice, advanced dashboard pages
# ──────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$(dirname "$SCRIPT_DIR")"
OUT="${OSS_OUT_DIR:-$(dirname "$SRC")/ultrathink-oss}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[BUILD]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC}    $*"; }
warn() { echo -e "${YELLOW}[SKIP]${NC}  $*"; }

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  UltraThink OSS Package Builder${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Clean previous build
if [[ -d "$OUT" ]]; then
  log "Removing previous build at $OUT"
  rm -rf "$OUT"
fi

mkdir -p "$OUT"

# ── 1. Root files ──────────────────────────────────────────────────
log "Copying root files..."
for f in README.md CONTRIBUTING.md LICENSE AGENTS.md \
         package.json package-lock.json pnpm-lock.yaml pnpm-workspace.yaml \
         .env.example .gitignore .prettierrc .nvmrc \
         eslint.config.js vitest.config.ts Dockerfile turbo.json; do
  [[ -f "$SRC/$f" ]] && cp "$SRC/$f" "$OUT/$f" && ok "$f" || warn "$f (not found)"
done

# ── 2. Scripts ─────────────────────────────────────────────────────
log "Copying scripts..."
mkdir -p "$OUT/scripts"
cp "$SRC/scripts/setup.sh" "$OUT/scripts/"
cp "$SRC/scripts/init-global.sh" "$OUT/scripts/"
cp "$SRC/scripts/migrate.sh" "$OUT/scripts/"
cp "$SRC/scripts/sync-editors.sh" "$OUT/scripts/"
[[ -f "$SRC/scripts/dashboard.sh" ]] && cp "$SRC/scripts/dashboard.sh" "$OUT/scripts/"
# install-studio.sh — one-liner that clones + builds + symlinks Studio.app.
# Public users curl this directly from main.
[[ -f "$SRC/scripts/install-studio.sh" ]] && cp "$SRC/scripts/install-studio.sh" "$OUT/scripts/"
chmod +x "$OUT/scripts/"*.sh
ok "scripts/"

# ── 3. GitHub templates ───────────────────────────────────────────
log "Copying GitHub config..."
if [[ -d "$SRC/.github" ]]; then
  cp -r "$SRC/.github" "$OUT/.github"
  ok ".github/"
fi

# ── 4. Memory system ──────────────────────────────────────────────
log "Copying memory system..."
mkdir -p "$OUT/memory/migrations" "$OUT/memory/schema" \
  "$OUT/packages/memory/src" "$OUT/packages/memory/scripts"

# Migrations (all — empty tables are harmless without the engine code)
cp "$SRC/memory/migrations/"*.sql "$OUT/memory/migrations/" 2>/dev/null || true
ok "memory/migrations/ ($(ls "$OUT/memory/migrations/" 2>/dev/null | wc -l | tr -d ' ') files)"

# Schema
[[ -f "$SRC/memory/schema/schema.sql" ]] && cp "$SRC/memory/schema/schema.sql" "$OUT/memory/schema/"

# package.json
[[ -f "$SRC/memory/package.json" ]] && cp "$SRC/memory/package.json" "$OUT/memory/"

# Core source — include everything EXCEPT adaptation.ts
for f in "$SRC/packages/memory/src/"*.ts; do
  fname="$(basename "$f")"
  case "$fname" in
    adaptation.ts|adaptation.d.ts|team-tekio.ts|team-tekio.d.ts)
      warn "packages/memory/src/$fname (Tekio — excluded)"
      ;;
    *)
      cp "$f" "$OUT/packages/memory/src/$fname"
      ;;
  esac
done
ok "packages/memory/src/ ($(ls "$OUT/packages/memory/src/" | wc -l | tr -d ' ') files)"

# Scripts — selective copy (exclude identity, wheel, advanced)
INCLUDE_SCRIPTS=(
  memory-runner.ts migrate.ts seed.ts compact.ts
  weekly-stats.ts usage-report.ts context-tree.ts context-tree-summary.ts
)
EXCLUDE_SCRIPTS=(
  archive-failures.ts
  cache-adaptations.ts seed-adaptations.ts
  wheel-count.ts
  re-enrich-all.ts
)
# As of 2026-05-09: identity.ts, archive-bad-identity.ts, archive-bad-prefs.ts
# moved into OSS so the identity graph is part of the public surface.

for f in "$SRC/packages/memory/scripts/"*.ts; do
  fname="$(basename "$f")"
  skip=false
  for ex in "${EXCLUDE_SCRIPTS[@]}"; do
    [[ "$fname" == "$ex" ]] && skip=true && break
  done
  if $skip; then
    warn "packages/memory/scripts/$fname (pro feature — excluded)"
  else
    cp "$f" "$OUT/packages/memory/scripts/$fname"
  fi
done
ok "packages/memory/scripts/ ($(ls "$OUT/packages/memory/scripts/" 2>/dev/null | wc -l | tr -d ' ') files)"

# ── 5. Hooks ──────────────────────────────────────────────────────
log "Copying hooks..."
mkdir -p "$OUT/.claude/hooks/dist"

# Include these hooks
INCLUDE_HOOKS=(
  prompt-submit.sh
  prompt-analyzer.ts
  post-edit-quality.sh
  privacy-hook.sh
  memory-session-start.sh
  memory-session-end.sh
  memory-auto-save.sh
  pre-compact.sh
  pre-compact-extract.ts
  tool-observe.sh
  context-monitor.sh
  statusline.sh
  progress-display.sh
  agent-tracker-pre.sh
  desktop-notify.sh
  notify.sh
  hook-log.sh
  format-check.sh
  tsconfig.json
)

# Exclude these hooks (pro features)
EXCLUDE_HOOKS=(
  tool-failure-log.sh
)
# As of 2026-05-09: decision-engine.ts, post-edit-codeintel.sh,
# codeintel-session-check.sh moved into OSS — code-intel is now public.

for f in "$SRC/.claude/hooks/"*; do
  fname="$(basename "$f")"
  [[ -d "$f" ]] && continue  # skip directories (dist/)

  skip=false
  for ex in "${EXCLUDE_HOOKS[@]}"; do
    [[ "$fname" == "$ex" ]] && skip=true && break
  done

  if $skip; then
    warn ".claude/hooks/$fname (pro feature — excluded)"
  else
    cp "$f" "$OUT/.claude/hooks/$fname"
  fi
done

# Copy compiled dist
[[ -f "$SRC/.claude/hooks/dist/prompt-analyzer.js" ]] && cp "$SRC/.claude/hooks/dist/prompt-analyzer.js" "$OUT/.claude/hooks/dist/"
[[ -f "$SRC/.claude/hooks/dist/decision-engine.js" ]] && cp "$SRC/.claude/hooks/dist/decision-engine.js" "$OUT/.claude/hooks/dist/"
ok ".claude/hooks/ ($(ls "$OUT/.claude/hooks/" 2>/dev/null | wc -l | tr -d ' ') files)"

# ── 5b. Code-Intel workspace ───────────────────────────────────────
log "Copying code-intel workspace..."
if [[ -d "$SRC/packages/code-intel" ]]; then
  mkdir -p "$OUT/packages/code-intel"
  # Copy src + hooks + reports + package.json + tsconfig + dist (if built).
  # Skip node_modules — the OSS user runs install themselves.
  for sub in src hooks reports dist package.json package-lock.json tsconfig.json; do
    [[ -e "$SRC/packages/code-intel/$sub" ]] && cp -r "$SRC/packages/code-intel/$sub" "$OUT/packages/code-intel/"
  done
  ok "packages/code-intel/ (cross-file dependency graph + 5 MCP tools)"
fi

# ── 5c. Studio engine (drives the desktop app) ────────────────────
log "Copying studio-engine..."
if [[ -d "$SRC/packages/studio-engine" ]]; then
  mkdir -p "$OUT/packages/studio-engine"
  for sub in src tests dist package.json package-lock.json tsconfig.json vitest.config.ts README.md; do
    [[ -e "$SRC/packages/studio-engine/$sub" ]] && cp -r "$SRC/packages/studio-engine/$sub" "$OUT/packages/studio-engine/"
  done
  ok "packages/studio-engine/ (sidecar + adapters + skill router)"
fi

# ── 5d. UltraThink Studio (Tauri desktop app) ────────────────────
# Moved from Core to OSS 2026-05-09 along with the dashboard. The .tauri-updater.key
# private key is gitignored upstream; only the public counterpart ships.
log "Copying apps/studio (Tauri desktop app)..."
if [[ -d "$SRC/apps/studio" ]]; then
  mkdir -p "$OUT/apps/studio"
  for sub in src src-tauri scripts public package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts index.html .gitignore README.md; do
    [[ -e "$SRC/apps/studio/$sub" ]] && cp -r "$SRC/apps/studio/$sub" "$OUT/apps/studio/"
  done
  # Strip the private updater key if it somehow got copied (paranoia — it
  # should be gitignored but cp of a working tree can still grab it).
  rm -f "$OUT/apps/studio/.tauri-updater.key" 2>/dev/null || true
  # Strip Rust build artifacts + Tauri-generated schemas (huge, regenerated on build).
  rm -rf "$OUT/apps/studio/src-tauri/target" 2>/dev/null || true
  rm -rf "$OUT/apps/studio/src-tauri/gen" 2>/dev/null || true
  rm -rf "$OUT/apps/studio/dist" 2>/dev/null || true
  rm -rf "$OUT/apps/studio/node_modules" 2>/dev/null || true
  ok "apps/studio/ (Tauri shell + Rust backend + React UI)"
fi

# ── 5e. Builder campaign script ───────────────────────────────────
if [[ -f "$SRC/scripts/upgrade-to-builder.sh" ]]; then
  cp "$SRC/scripts/upgrade-to-builder.sh" "$OUT/scripts/"
  chmod +x "$OUT/scripts/upgrade-to-builder.sh"
  ok "scripts/upgrade-to-builder.sh (builder campaign promotion)"
fi

# ── 6. Skills (full library minus private) ────────────────────────
log "Copying skills (full library)..."
mkdir -p "$OUT/.claude/skills"

# Only exclude skills that depend on private features
EXCLUDE_SKILLS=(
  agora                    # Agora voice (private)
  _affiliate-references    # Internal reference file
)

skill_count=0
for skill_dir in "$SRC/.claude/skills/"*/; do
  skill="$(basename "$skill_dir")"

  skip=false
  for ex in "${EXCLUDE_SKILLS[@]}"; do
    [[ "$skill" == "$ex" ]] && skip=true && break
  done

  if $skip; then
    warn "skills/$skill (private — excluded)"
  else
    cp -r "$skill_dir" "$OUT/.claude/skills/$skill"
    skill_count=$((skill_count + 1))
  fi
done
ok "Skills: $skill_count copied"

# Build filtered _registry.json (remove excluded skills)
if [[ -f "$SRC/.claude/skills/_registry.json" ]] && command -v node &>/dev/null; then
  log "Building filtered _registry.json..."
  EXCLUDE_LIST=$(printf '"%s",' "${EXCLUDE_SKILLS[@]}" | sed 's/,$//')
  node -e "
    const fs = require('fs');
    const registry = JSON.parse(fs.readFileSync('$SRC/.claude/skills/_registry.json', 'utf-8'));
    const exclude = new Set([$EXCLUDE_LIST]);
    const filteredSkills = (registry.skills || [])
      .filter(skill => !exclude.has(skill.name))
      .map(skill => ({
        ...skill,
        linksTo: (skill.linksTo || []).filter(link => !exclude.has(link)),
        linkedFrom: (skill.linkedFrom || []).filter(link => !exclude.has(link)),
      }));

    const layers = filteredSkills.reduce((acc, skill) => {
      const layer = skill.layer || 'unknown';
      acc[layer] = (acc[layer] || 0) + 1;
      return acc;
    }, {});

    const filtered = {
      ...registry,
      skillCount: filteredSkills.length,
      layers,
      skills: filteredSkills,
    };

    fs.writeFileSync('$OUT/.claude/skills/_registry.json', JSON.stringify(filtered, null, 2) + '\n');
    console.log('  Filtered: ' + filteredSkills.length + ' skills in registry');
  " 2>/dev/null || warn "Could not filter _registry.json — copying full version"
fi

# ── 7. Agents ─────────────────────────────────────────────────────
log "Copying agents..."
if [[ -d "$SRC/.claude/agents" ]]; then
  cp -r "$SRC/.claude/agents" "$OUT/.claude/agents"
  ok "agents/ ($(ls "$OUT/.claude/agents/" 2>/dev/null | wc -l | tr -d ' ') files)"
fi

# ── 8. References ─────────────────────────────────────────────────
log "Copying references..."
if [[ -d "$SRC/.claude/references" ]]; then
  cp -r "$SRC/.claude/references" "$OUT/.claude/references"
  ok "references/ ($(ls "$OUT/.claude/references/" 2>/dev/null | wc -l | tr -d ' ') files)"
fi

# ── 9. Commands ───────────────────────────────────────────────────
log "Copying commands..."
if [[ -d "$SRC/.claude/commands" ]]; then
  mkdir -p "$OUT/.claude/commands"
  for f in "$SRC/.claude/commands/"*.md; do
    [[ -f "$f" ]] || continue
    fname="$(basename "$f")"
    if grep -q '/Users/inugami' "$f"; then
      warn ".claude/commands/$fname (local absolute path — excluded)"
    else
      cp "$f" "$OUT/.claude/commands/$fname"
    fi
  done
  ok "commands/ ($(ls "$OUT/.claude/commands/" 2>/dev/null | wc -l | tr -d ' ') files)"
fi

# ── 10. Config files ──────────────────────────────────────────────
log "Copying config..."
[[ -f "$SRC/.claude/ck.json" ]] && cp "$SRC/.claude/ck.json" "$OUT/.claude/"
[[ -f "$SRC/.claude/settings.json" ]] && cp "$SRC/.claude/settings.json" "$OUT/.claude/"
[[ -f "$SRC/.ckignore" ]] && cp "$SRC/.ckignore" "$OUT/"
[[ -f "$SRC/.claudeignore" ]] && cp "$SRC/.claudeignore" "$OUT/"
ok "config files"

# ── 11. Dashboard (partial) ──────────────────────────────────────
log "Copying dashboard..."
mkdir -p "$OUT/dashboard"
DASHBOARD_SRC="$SRC/dashboard"
if [[ ! -d "$DASHBOARD_SRC" && -d "$SRC/apps/dashboard" ]]; then
  DASHBOARD_SRC="$SRC/apps/dashboard"
fi

# Copy dashboard root files
for f in package.json package-lock.json tsconfig.json postcss.config.mjs \
         tailwind.config.ts next.config.ts next-env.d.ts; do
  [[ -f "$DASHBOARD_SRC/$f" ]] && cp "$DASHBOARD_SRC/$f" "$OUT/dashboard/"
done

# Copy dashboard lib, components, public
for dir in lib components public; do
  if [[ -d "$DASHBOARD_SRC/$dir" ]]; then
    cp -r "$DASHBOARD_SRC/$dir" "$OUT/dashboard/$dir"
  fi
done
rm -rf "$OUT/dashboard/lib/agora"

# Copy app directory selectively (exclude pro pages)
mkdir -p "$OUT/dashboard/app"

# Copy root layout, globals, etc.
for f in "$DASHBOARD_SRC/app/"*; do
  [[ -e "$f" ]] || continue
  [[ -d "$f" ]] && continue
  cp "$f" "$OUT/dashboard/app/"
done

# Dashboard pages: ship everything to OSS. Only the agora-specific page stays
# Core because it depends on the agora MCP / proprietary credentials.
# (As of 2026-05-09, dashboard moved to OSS in full.)
INCLUDE_PAGES=()
EXCLUDE_PAGES=(
  agora
)

for page_dir in "$DASHBOARD_SRC/app/"*/; do
  [[ -d "$page_dir" ]] || continue
  page_name="$(basename "$page_dir")"

  # API routes are copied selectively below so paid endpoints cannot slip in via the full app copy.
  if [[ "$page_name" == "api" ]]; then
    continue
  fi

  # Skip if starts with ( — these are route groups, copy them
  if [[ "$page_name" == \(* ]]; then
    cp -r "$page_dir" "$OUT/dashboard/app/$page_name"
    continue
  fi

  skip=false
  for ex in "${EXCLUDE_PAGES[@]}"; do
    [[ "$page_name" == "$ex" ]] && skip=true && break
  done

  if $skip; then
    warn "dashboard/app/$page_name/ (pro page — excluded)"
  else
    cp -r "$page_dir" "$OUT/dashboard/app/$page_name"
  fi
done

# Copy API routes (selective)
if [[ -d "$DASHBOARD_SRC/app/api" ]]; then
  mkdir -p "$OUT/dashboard/app/api"
  # Ship all dashboard APIs to OSS. Only agora stays Core (proprietary service).
  INCLUDE_APIS=()
  EXCLUDE_APIS=(agora)

  for api_dir in "$DASHBOARD_SRC/app/api/"*/; do
    [[ -d "$api_dir" ]] || continue
    api_name="$(basename "$api_dir")"
    skip=false
    for ex in "${EXCLUDE_APIS[@]}"; do
      [[ "$api_name" == "$ex" ]] && skip=true && break
    done
    if $skip; then
      warn "dashboard/app/api/$api_name/ (pro API — excluded)"
    else
      cp -r "$api_dir" "$OUT/dashboard/app/api/$api_name"
    fi
  done
fi

ok "dashboard/ ($(find "$OUT/dashboard/app" -name "page.tsx" 2>/dev/null | wc -l | tr -d ' ') pages)"

# ── 12. Widgets ───────────────────────────────────────────────────
log "Copying widgets..."
if [[ -d "$SRC/widgets" ]]; then
  cp -r "$SRC/widgets" "$OUT/widgets"
  ok "widgets/"
fi

# ── 13. Docs ──────────────────────────────────────────────────────
log "Copying docs..."
mkdir -p "$OUT/docs/assets"
if [[ -d "$SRC/docs" ]]; then
  for f in "$SRC/docs/"*.md; do
    fname="$(basename "$f")"
    # Exclude docs that reference pro features heavily
    case "$fname" in
      AUDIT-*|M0-MERGE-AUDIT.md|*tekio*|*adaptation*|*identity-graph*)
        warn "docs/$fname (pro docs — excluded)"
        ;;
      *)
        cp "$f" "$OUT/docs/$fname"
        ;;
    esac
  done
  # Copy assets
  [[ -d "$SRC/docs/assets" ]] && cp -r "$SRC/docs/assets/"* "$OUT/docs/assets/" 2>/dev/null || true
  ok "docs/ ($(ls "$OUT/docs/"*.md 2>/dev/null | wc -l | tr -d ' ') files)"
fi

# ── 14. Tests ─────────────────────────────────────────────────────
log "Copying tests..."
if [[ -d "$SRC/tests" ]]; then
  cp -r "$SRC/tests" "$OUT/tests"
  ok "tests/"
fi

# ── 15. MCP config ────────────────────────────────────────────────
log "Creating .mcp.json (VFS + code-intel + stitch)..."
cat > "$OUT/.mcp.json" << 'EOF'
{
  "mcpServers": {
    "vfs": {
      "command": "vfs",
      "args": ["mcp"],
      "env": {}
    },
    "code-intel": {
      "command": "node",
      "args": ["packages/code-intel/dist/mcp-server.js"],
      "env": {}
    },
    "stitch": {
      "command": "npx",
      "args": ["-y", "@google/stitch-mcp"],
      "env": {}
    }
  }
}
EOF
ok ".mcp.json (VFS + code-intel + stitch — agora and tekio MCP tools excluded)"

# ── 15b. install-pack.sh — drop-in skill installer ────────────────
log "Copying install-pack.sh..."
if [[ -f "$SRC/scripts/install-pack.sh" ]]; then
  cp "$SRC/scripts/install-pack.sh" "$OUT/scripts/install-pack.sh"
  chmod +x "$OUT/scripts/install-pack.sh"
  ok "scripts/install-pack.sh (clone-and-link any skill repo into your workflow)"
fi

# ── 15c. OSS-specific README + INSTALL ──────────────────────────────
# We overwrite the README copied from Core with an OSS-branded one. Same for
# the install guide — Core's docs/INSTALL-OSS.md becomes the OSS top-level
# INSTALL.md so a fresh cloner doesn't have to dig through docs/.
log "Generating OSS-branded README + INSTALL..."
cat > "$OUT/README.md" << 'README_EOF'
<p align="center">
  <img src="docs/assets/ultrathink-logo-1.png" alt="UltraThink" width="540" />
</p>

<h1 align="center">UltraThink — OSS</h1>
<p align="center">
  <strong>Build Until Ship.</strong> Get and build your own pipeline.
</p>

<p align="center">
  <a href="INSTALL.md">Install</a> &bull;
  <a href="#what-you-get">Features</a> &bull;
  <a href="#install-a-skill-pack">Skill packs</a> &bull;
  <a href="#license">License</a>
</p>

---

UltraThink is an opinionated workflow OS for AI coding agents. It turns
Claude Code (and Codex, OpenAI-compatible runners, Ollama) from a stateless
chat into a **persistent, skill-aware engineer** that remembers your
decisions, enforces your standards, and adapts to how *you* build software.

**Our principle:** software gets shipped by people who own their pipeline.
UltraThink gives you the pipeline. You own it. You ship.

## What you get

- **230+ skills** in a 4-layer mesh (orchestrator → hub → utility → domain),
  auto-routed per prompt
- **Persistent memory** on Postgres with a 4-wing knowledge graph, hybrid
  search, and Zettelkasten relations
- **Code intelligence** — 5 cross-file dependency MCP tools that answer
  "what breaks if I change this?" without reading a single file
- **Decision engine** — 12 reasoning frameworks injected when a prompt
  smells like a real architectural call
- **Identity graph** — long-term `who is this user, what do they prefer,
  what are they building` that survives session boundaries
- **VFS** — AST-signature MCP for code exploration with 60–98% token savings
- **Studio** — cross-platform Tauri desktop app: 3D knowledge graph,
  project-first chat, concurrent agent runner, OS keychain, checkpoints
- **Dashboard** — Next.js 15 observability surface at `:3333` (memory graph,
  activity, hooks, skills, ops, kanban, analytics)
- **install-pack.sh** — `./install-pack.sh https://github.com/acme/skills`
  drops any skill repo into your workflow

## Install — one line

```sh
curl -fsSL https://raw.githubusercontent.com/InugamiDev/ultrathink-oss/main/scripts/install-studio.sh | bash
```

This clones the repo to `~/ultrathink`, installs deps, builds Studio.app, and
(macOS) symlinks it into `/Applications/`. Prereqs: **Node 22+**, **pnpm 9+**,
**Rust 1.77+** (for the Studio Tauri build). It will tell you what's missing.

After install, edit `~/ultrathink/.env` and set:

- `DATABASE_URL=postgres://...neon.tech/...` — required for the memory graph
- `ANTHROPIC_API_KEY=sk-ant-...` — optional if you have the `claude` CLI

Open Studio: `open '/Applications/UltraThink Studio.app'` (or run from
`~/ultrathink/apps/studio/src-tauri/target/release/bundle/macos/`).

## Install — manual

```sh
git clone https://github.com/InugamiDev/ultrathink-oss.git ~/ultrathink
cd ~/ultrathink
cp .env.example .env  # set DATABASE_URL + ANTHROPIC_API_KEY
pnpm install
./scripts/install.sh          # symlinks skills + hooks into ~/.claude
cd apps/studio && pnpm tauri:dev   # or: pnpm tauri:build
```

See **[INSTALL.md](INSTALL.md)** for prereq details, troubleshooting, and the
dashboard/release flows.

## Install a skill pack

The killer move — drop someone else's skill repo into your workflow:

```sh
./scripts/install-pack.sh https://github.com/acme/awesome-skills
```

Optional name prefix to avoid collisions:

```sh
./scripts/install-pack.sh https://github.com/acme/awesome-skills acme-
```

That's `Build Until Ship` in two lines: someone else's pipeline becomes
yours, your next prompt sees it, you keep moving.

## What's NOT here (Core only)

- **Tekiō** — adaptive learning that auto-counters repeat failures and
  reinforces successes
- **Agora** — voice-driven agent integration (separately licensed)
- A handful of proprietary domain skills under InuVerse's allowlist

If you need those, talk to InuVerse — Core is a private distribution.

## License

MIT. Build whatever you want with it.

---

<p align="center">
  <em>UltraThink isn't the AI. UltraThink is <strong>you</strong> — and it makes you the master of your AI.</em>
</p>
README_EOF
ok "README.md (OSS-branded with Build Until Ship principle)"

if [[ -f "$SRC/docs/INSTALL-OSS.md" ]]; then
  cp "$SRC/docs/INSTALL-OSS.md" "$OUT/INSTALL.md"
  ok "INSTALL.md (top-level install guide)"
fi

# ── 16. CLAUDE.md (OSS version) ──────────────────────────────────
log "Creating CLAUDE.md (OSS version)..."
cat > "$OUT/CLAUDE.md" << 'CLAUDEMD'
# UltraThink — Claude Workflow OS

> 4-layer skill mesh, persistent memory, identity graph, decision engine,
> code intelligence, privacy hooks, observability dashboard.

## Identity

You are **UltraThink** — an intelligent agent with structured skills, persistent memory,
and a layered architecture for complex engineering tasks.

## Tech Stack

- **Runtime**: Claude Code CLI / Codex CLI | **Dashboard**: Next.js 15 + Tailwind v4 (port 3333)
- **Database**: Neon Postgres + pgvector + pg_trgm
- **Skills**: 230+ across 4 layers (orchestrator, hub, utility, domain)
- **Memory**: Postgres-backed fuzzy search (tsvector + trigram + ILIKE) with identity graph
- **Hooks**: Pre/post tool hooks + auto-trigger + decision engine
- **Tools**: VFS (AST signatures), Code-Intel (5 MCP tools), Stitch (design)

## Skill Mesh

4 layers: **Orchestrators** → **Hubs** → **Utilities** → **Domain Specialists**.
Skills link via `linksTo`/`linkedFrom` in `.claude/skills/_registry.json`.
When a task matches a skill's triggers, load its `SKILL.md`.
**Auto-trigger**: UserPromptSubmit hook scores skills, injects top 5 via `additionalContext`.
**Intent detection**: build/debug/refactor/explore/deploy/test/design/plan → category boosting.

## Install a skill pack

```sh
./scripts/install-pack.sh <git-repo-url>
```

Clones any repo that ships a `.claude/skills/` tree, symlinks each skill into
`~/.claude/skills/`, and merges its registry into yours. Your next prompt sees
the new skills automatically.

## Memory + Identity Graph

- Storage: `packages/memory/src/memory.ts` → Neon Postgres
- Auto-memory: `/tmp/ultrathink-memories/<ts>-<slug>.json` → flushed at session end
- SessionStart recalls memories; Stop flushes + closes session
- **Identity graph**: `packages/memory/scripts/identity.ts` builds a graph of
  user identity / preferences / projects. CLI: `memory-runner.ts identity`.
- **Search**: Hybrid tsvector + pg_trgm + ILIKE with synonym expansion

## Decision Engine

`.claude/hooks/decision-engine.ts` injects 12 reasoning frameworks (MECE,
Issue Tree, Pre-Mortem, Weighted Matrix, etc.) when a prompt looks like a
non-trivial decision. Triggered automatically — no manual invocation.

## Code-Intel — Cross-file dependency graph

5 MCP tools:
- `code-symbols` — search symbol definitions
- `code-deps` — what does X import / call?
- `code-dependents` — what calls / imports X?
- `code-impact` — transitive blast radius for a change
- `code-modules` — semantic clusters

Indexed incrementally on edits via `post-edit-codeintel.sh`.

## Key Paths

| Area | Path |
|------|------|
| Config | `.claude/ck.json` |
| Skills | `.claude/skills/[name]/SKILL.md` |
| References | `.claude/references/*.md` |
| Hooks | `.claude/hooks/*.sh`, `prompt-analyzer.ts`, `decision-engine.ts` |
| Memory | `packages/memory/` |
| Code-Intel | `packages/code-intel/` |
| Dashboard | `dashboard/` |

## References (read on demand, not auto-loaded)

- `core.md` — Response patterns, skill selection, VFS usage, error handling
- `memory.md` — Memory read/write discipline, compaction rules
- `privacy.md` — File access control, sensitivity levels, logging
- `quality.md` — Code standards (TS, React, SQL), review checklist
- `teaching.md` — Coding level adaptation (beginner→expert)

## Compaction Guidance

**Preserve**: current task + progress, files modified, decisions + rationale, pending work, debug context.
**Drop**: exploratory reads already acted on, verbose tool output, drafts, CLAUDE.md (reloads), full file contents (reference by path).
CLAUDEMD
ok "CLAUDE.md (OSS version — no Tekio, no identity graph)"

# ── 17. AGENTS.md (OSS Codex version) ───────────────────────────
log "Refreshing AGENTS.md (OSS Codex version)..."
if [[ -x "$OUT/scripts/sync-editors.sh" ]]; then
  (
    cd "$OUT"
    ./scripts/sync-editors.sh --codex >/dev/null
  )
  ok "AGENTS.md (OSS Codex version)"
else
  warn "AGENTS.md refresh skipped — sync-editors.sh not available"
fi

# ── Done ──────────────────────────────────────────────────────────
echo ""

# Count totals
TOTAL_FILES=$(find "$OUT" -type f | wc -l | tr -d ' ')
TOTAL_SIZE=$(du -sh "$OUT" 2>/dev/null | cut -f1)

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  OSS Package Built!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Location:  $OUT"
echo "  Files:     $TOTAL_FILES"
echo "  Size:      $TOTAL_SIZE"
echo ""
echo "  Excluded (pro):"
echo "    - Tekio adaptive learning engine"
echo "    - Agora voice integration (skill, MCP, dashboard page, API)"
echo "  Included in OSS as of 2026-05-09:"
echo "    - Identity graph + preference extraction"
echo "    - Decision engine (12 frameworks)"
echo "    - Code-Intel workspace + 5 MCP tools"
echo "    - Stitch design MCP"
echo "    - install-pack.sh (clone-and-link any skill repo)"
echo "    - Full Next.js dashboard (memory graph, activity, hooks, skills,"
echo "      plans, settings, system, cmo, ops, voice, testing, analytics,"
echo "      kanban, integrations) + all dashboard APIs except agora"
echo ""
echo "  Publish policy:"
echo "    - Keep $SRC private"
echo "    - Only publish the generated OSS bundle at $OUT"
echo ""
echo "  Next steps:"
echo "    cd $OUT"
echo "    git init && git add . && git commit -m 'Initial open-source release'"
echo "    gh repo create InuVerse/ultrathink-oss --public --source=."
echo ""

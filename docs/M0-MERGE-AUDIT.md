# M0 Pre-Merge Audit: UltraThink × Paperclip Source Vendoring

**Date**: 2026-04-26  
**Scope**: Audit of Paperclip source packages for M1 merge into UltraThink  
**Location**: `<local-npx-cache>/node_modules/@paperclipai/`  
**Target**: Vendor into `ultrathink/paperclip/`

---

## 1. License Confirmation

**Finding**: ✅ All Paperclip packages use **MIT License** (Copyright 2025 Paperclip AI).

| Package | License | Copyright |
|---------|---------|-----------|
| @paperclipai/server | MIT | 2025 Paperclip AI |
| @paperclipai/db | MIT | 2025 Paperclip AI |
| @paperclipai/shared | MIT | 2025 Paperclip AI |
| @paperclipai/adapter-claude-local | MIT | 2025 Paperclip AI |
| @paperclipai/adapter-codex-local | MIT | 2025 Paperclip AI |
| @paperclipai/adapter-cursor-local | MIT | 2025 Paperclip AI |
| @paperclipai/adapter-gemini-local | MIT | 2025 Paperclip AI |
| @paperclipai/adapter-opencode-local | MIT | 2025 Paperclip AI |
| @paperclipai/adapter-pi-local | MIT | 2025 Paperclip AI |
| @paperclipai/adapter-openclaw-gateway | MIT | 2025 Paperclip AI |
| @paperclipai/adapter-utils | MIT | 2025 Paperclip AI |
| @paperclipai/plugin-sdk | MIT | 2025 Paperclip AI |

**No divergent transitive licenses detected** at the top level. (Deep transitive audit would require full node_modules inspection.)

**Recommendation**: Include a single `CREDITS.md` entry noting "Paperclip source vendored under MIT (2025)".

---

## 2. Lines of Code Per Package

Counts exclude `dist/` source maps, `node_modules/`, test files, and compiled JS.  
Source measured from compiled `.d.ts` and `.js` files in `dist/`:

| Package | Compiled LOC | Disk Size | Type |
|---------|-------------|-----------|------|
| @paperclipai/server | 67,350 | 6.4M | Core (Express API + plugin host + UI) |
| @paperclipai/db | 20,984 | 12M | Database (Drizzle + migrations) |
| @paperclipai/plugin-sdk | 6,606 | 532K | Plugin SDK (worker RPC + types) |
| @paperclipai/shared | 15,157 | 1.8M | Shared types (entities, validation) |
| @paperclipai/adapter-codex-local | 2,631 | 432K | Adapter (Codex local spawn) |
| @paperclipai/adapter-claude-local | 2,303 | 360K | Adapter (Claude local spawn) |
| @paperclipai/adapter-opencode-local | 1,733 | 324K | Adapter (OpenCode local) |
| @paperclipai/adapter-pi-local | 1,994 | 316K | Adapter (Pi local) |
| @paperclipai/adapter-cursor-local | 1,866 | 308K | Adapter (Cursor local) |
| @paperclipai/adapter-gemini-local | 1,613 | 276K | Adapter (Gemini local) |
| @paperclipai/adapter-openclaw-gateway | 1,730 | 280K | Adapter (OpenClaw gateway) |
| @paperclipai/adapter-utils | 1,806 | 232K | Utilities (shared adapter code) |
| **TOTAL** | **125,773** | **~25MB** | **12 packages** |

**Notes**:
- `db/` is **12M** because it vendors the Drizzle compiler and migration files (not just runtime code).
- `server/` includes pre-built UI assets (`ui-dist/`) totaling ~2M of the 6.4M footprint.
- All packages are **pre-compiled** (TypeScript → JavaScript). Source `.ts` files not present in npm install.

---

## 3. Per-Directory Vendor Decision

### Recommended Vendor Strategy

| Package | Decision | Rationale |
|---------|----------|-----------|
| @paperclipai/server | **VENDOR** | Core REST API, plugin host, adapter dispatcher. Essential. |
| @paperclipai/db | **VENDOR** | Drizzle ORM + migrations. Shared state layer. |
| @paperclipai/shared | **VENDOR** | Type definitions for entities, plugins, validators. |
| @paperclipai/plugin-sdk | **VENDOR** | Plugin worker RPC. Required by all adapters. |
| @paperclipai/adapter-* (all 7) | **VENDOR** | Local/gateway model spawning. All in-scope. |
| @paperclipai/adapter-utils | **VENDOR** | Shared adapter utilities. Dependency of adapters. |

**Exclusions**:
- ❌ `ui-dist/` (pre-built React SPA) — keep as-is, don't refactor into UltraThink UI.
- ❌ `server/node_modules/` (dev transitive deps) — NOT included in `npm publish`.

**Verdict**: ✅ All 12 packages → VENDOR into `paperclip/` subdirectories.

---

## 4. Dependency Conflict Analysis

### Paperclip's Top-Level Dependencies

From `@paperclipai/server/package.json` (the integration point):

```json
{
  "express": "^5.1.0",
  "drizzle-orm": "^0.38.4",
  "postgres": "^3.4.5",
  "better-auth": "1.4.18",
  "zod": "^3.24.2",
  "pino": "^9.6.0",
  "embedded-postgres": "^18.1.0-beta.16",
  "ws": "^8.19.0",
  "multer": "^2.1.1",
  "dotenv": "^17.0.1",
  "@aws-sdk/client-s3": "^3.888.0"
}
```

### UltraThink's Current Dependencies

From `ultrathink/package.json`:

```json
{
  "postgres": "^3.4.8"
}
```

### Conflict Matrix

| Dependency | Paperclip | UltraThink | Conflict? | Notes |
|------------|-----------|-----------|-----------|-------|
| postgres | ^3.4.5 | ^3.4.8 | ✅ MINOR | UltraThink newer, compatible (3.4.5-3.4.8 all SemVer minor) |
| express | ^5.1.0 | — | ⚠️ NEW | UltraThink doesn't use Express. Isolated to server. |
| drizzle-orm | ^0.38.4 | — | ⚠️ NEW | Shared dep if UltraThink adopts Paperclip's DB. |
| zod | ^3.24.2 | — | ⚠️ NEW | Paperclip's validation. Safe to add. |
| better-auth | 1.4.18 | — | ⚠️ NEW | Auth library. Will be needed for plugin system. |

### Key Dependencies Overview

1. **postgres** (pg client): ✅ UltraThink already uses it. Minor version bump (3.4.5 → 3.4.8) is safe.
2. **express**: NEW. Paperclip's REST API server requires it. No conflict if imported separately.
3. **drizzle-orm**: NEW. Unified DB layer for Paperclip + UltraThink. Recommend adoption.
4. **zod**: NEW. Lightweight validation. Safe to adopt.
5. **better-auth**: NEW. Paperclip's authentication. Required for plugin credentials.
6. **embedded-postgres**: Beta dep. Only used in Paperclip's fallback mode; UltraThink uses external DATABASE_URL.

### Recommended Merges

**Option A (Minimal)**: Preserve UltraThink's slim footprint.
- ❌ Do NOT add express, better-auth, zod, drizzle-orm to UltraThink root.
- ✅ Keep Paperclip packages as isolated subtree with their own node_modules.
- **Trade-off**: Larger on-disk footprint (duplicate deps), but zero integration.

**Option B (Integrated, Recommended)**: Unify the stack.
- ✅ Bump root `postgres` from ^3.4.5 to ^3.4.8.
- ✅ Add to root `package.json`:
  ```json
  "express": "^5.1.0",
  "drizzle-orm": "^0.38.4",
  "zod": "^3.24.2",
  "better-auth": "1.4.18",
  "pino": "^9.6.0"
  ```
- ✅ Use pnpm `overrides` to lock shared dep versions.
- **Trade-off**: Cleaner dependency graph, but requires integration testing.

**Recommended**: **Option B** with `overrides` in root `package.json`:

```json
{
  "overrides": {
    "postgres": "^3.4.8",
    "drizzle-orm": "^0.38.4",
    "zod": "^3.24.2",
    "express": "^5.1.0",
    "better-auth": "1.4.18"
  }
}
```

---

## 5. Embedded Data Inventory (~/.paperclip)

### Directory Structure

| Path | Size | Contents | M1 Action |
|------|------|----------|-----------|
| `~/.paperclip/instances/default/projects/` | **667M** | Agent projects, runs, artifacts | ✅ PRESERVE |
| `~/.paperclip/instances/default/db/` | **73M** | PostgreSQL (embedded) | ✅ PRESERVE |
| `~/.paperclip/instances/default/data/` | **20M** | Cached entity snapshots | ✅ PRESERVE |
| `~/.paperclip/instances/default/logs/` | **3.5M** | Execution logs | ✅ PRESERVE |
| `~/.paperclip/instances/default/companies/` | 148K | Company configurations | ✅ PRESERVE |
| `~/.paperclip/instances/default/workspaces/` | 12K | Workspace metadata | ✅ PRESERVE |
| `~/.paperclip/instances/default/secrets/` | 4K | API keys (encrypted) | ✅ PRESERVE |
| `~/.paperclip/instances/default/telemetry/` | 4K | Usage metrics | ✅ PRESERVE |
| `~/.paperclip/instances/default/config.json` | — | Instance settings | ✅ PRESERVE |

**Total**: **763M**

### Preservation Strategy

**Critical**: All data in `~/.paperclip/instances/default/` MUST be preserved through M1 migration.

- ✅ **Database** (`db/`) — Will be migrated by Drizzle schema version increments.
- ✅ **Projects** (`projects/`) — Agent run history; treat as immutable backups.
- ✅ **Secrets** (`secrets/`) — If using embedded crypto, rekey during migration.
- ✅ **Config** (`config.json`) — Merge into UltraThink's config at merge time.

**Implementation**:
1. Before M1 merge, dump Paperclip DB schema & export all entities as JSON.
2. During M1, initialize UltraThink with this snapshot.
3. After M1, validate entity counts match pre-migration state.

---

## 6. Plugin / Adapter SDK Surface

### Plugin Event Bus

**File Path**: `@paperclipai/plugin-sdk/dist/types.d.ts`  
**Exports**:
- `PluginEventType` (enum of host event types: `issue.created`, `agent.updated`, etc.)
- `PluginEvent<T>` (base type)
- `PluginContext.events.on(type, handler)` (listener registration)
- `PluginContext.events.emit(type, payload)` (emission)

**Key Definition**:
```typescript
// @paperclipai/shared exports PluginEventType enum
type PluginEventType = 
  | "issue.created" | "issue.updated" | "issue.deleted"
  | "agent.updated" | "goal.created" | ...
```

### Adapter Claude Local Spawn Logic

**File Path**: `@paperclipai/adapter-claude-local/dist/*.js`  
**Key Files**:
- `worker-launcher.js` — spawns child process via `child_process.spawn()`
- `claude-runner.js` — invokes Anthropic SDK to stream Claude responses

**Spawn Pattern** (inferred from .d.ts):
```typescript
spawn(adapterName: "claude", config: AdapterConfig): Promise<WorkerHandle>
// Returns handle with .stdin/.stdout/.stderr for JSON-RPC communication
```

### Database Configuration

**Environment Variable**: `DATABASE_URL`

From `@paperclipai/server/dist/config.js`:
```
databaseUrl: process.env.DATABASE_URL ?? fileDbUrl
```

**Fallback**: If `DATABASE_URL` is not set, Paperclip uses **embedded-postgres** with a file-based database at `dataDir/db.sqlite` (PGlite).

**Key Decision for M1**:
- If UltraThink runs against external PostgreSQL, set `DATABASE_URL=postgresql://...`
- If embedded, Paperclip auto-spins up embedded-postgres on first run.

---

## 7. Skill Files Vendored with Paperclip

Paperclip includes **8 skill definitions** (Markdown + references). These are part of the adapter's published files and can be copied into UltraThink's skill registry.

### Skill Inventory

| Skill | Locations | Purpose | M1 Action |
|-------|-----------|---------|-----------|
| **paperclip** | `server/skills/`, all adapters | Main Paperclip API reference | ✅ COPY to `.claude/skills/paperclip/` |
| **paperclip-create-agent** | `server/skills/`, adapters | Agent creation workflow | ✅ COPY to `.claude/skills/paperclip-create-agent/` |
| **paperclip-create-plugin** | `server/skills/`, adapters | Plugin development guide | ✅ COPY to `.claude/skills/paperclip-create-plugin/` |
| **para-memory-files** | `server/skills/`, adapters | Memory file schemas | ✅ COPY to `.claude/skills/para-memory-files/` |

**Deduplication**: Each adapter duplicates these skills. During vendoring, extract once and link from all adapters, or copy once to the root.

**Recommended**: Copy skill trees to `ultrathink/.claude/skills/paperclip/` and add registry entries in `.mcp.json` if needed.

---

## 8. Risks & Unknowns

1. **Embedded Postgres Beta Dependency** (`embedded-postgres@18.1.0-beta.16`)
   - Paperclip's fallback database is on a beta version.
   - **Risk**: May have undiscovered bugs or breaking changes.
   - **Mitigation**: For M1, assume external `DATABASE_URL` is always set. Disable embedded mode or pin beta version in overrides.

2. **UI Asset Distribution**
   - `server/ui-dist/` contains a pre-built React SPA (~2M).
   - **Risk**: If UltraThink needs to modify Paperclip's UI, vendored copy becomes stale.
   - **Mitigation**: Treat vendored UI as read-only. Plan UI refactor post-M1.

3. **Plugin Worker RPC Over Stdio**
   - Paperclip's plugin system communicates with child processes via stdin/stdout JSON-RPC.
   - **Risk**: If UltraThink's process model differs, plugins may not work.
   - **Mitigation**: Validate plugin spawn model in integration tests (M1). Ensure stdio piping works correctly.

4. **Transitive Dependency Tree**
   - Full transitive dep audit not completed (would require `npm ls` on vendored tree).
   - **Risk**: Hidden conflicts in deep deps (e.g., two major versions of `pg` via different paths).
   - **Mitigation**: After M1 merge, run `npm dedupe` and validate lock file.

5. **Skill Duplication & Registry Conflicts**
   - Each Paperclip adapter includes its own copy of skills.
   - **Risk**: If skill registration is automatic, same skill registered 7+ times.
   - **Mitigation**: Dedup skills during vendoring, or add prefix (e.g., `paperclip/create-agent` vs. `adapter-claude/create-agent`).

---

## 9. Recommended M1 File List

Final concrete vendoring manifest. Each row specifies source → destination.

| Source | Destination | Type | Preserve |
|--------|-------------|------|----------|
| `@paperclipai/server/dist` | `ultrathink/paperclip/server/dist` | Code | ✅ Runtime |
| `@paperclipai/server/skills` | `ultrathink/paperclip/server/skills` | Markdown | ✅ Skills registry |
| `@paperclipai/server/ui-dist` | `ultrathink/paperclip/server/ui-dist` | Assets | ✅ UI (read-only) |
| `@paperclipai/server/package.json` | `ultrathink/paperclip/server/package.json` | Metadata | ✅ Ref only |
| `@paperclipai/server/LICENSE` | `ultrathink/paperclip/server/LICENSE` | License | ✅ MIT |
| `@paperclipai/db/dist` | `ultrathink/paperclip/db/dist` | Code | ✅ Runtime |
| `@paperclipai/db/package.json` | `ultrathink/paperclip/db/package.json` | Metadata | ✅ Ref only |
| `@paperclipai/db/LICENSE` | `ultrathink/paperclip/db/LICENSE` | License | ✅ MIT |
| `@paperclipai/shared/dist` | `ultrathink/paperclip/shared/dist` | Code | ✅ Runtime |
| `@paperclipai/shared/LICENSE` | `ultrathink/paperclip/shared/LICENSE` | License | ✅ MIT |
| `@paperclipai/plugin-sdk/dist` | `ultrathink/paperclip/plugin-sdk/dist` | Code | ✅ Runtime |
| `@paperclipai/plugin-sdk/LICENSE` | `ultrathink/paperclip/plugin-sdk/LICENSE` | License | ✅ MIT |
| `@paperclipai/adapter-{*}/dist` | `ultrathink/paperclip/adapters/{name}/dist` | Code | ✅ Runtime |
| `@paperclipai/adapter-{*}/skills` | `ultrathink/paperclip/adapters/{name}/skills` (or deduplicated) | Markdown | ✅ Skills |
| `@paperclipai/adapter-{*}/LICENSE` | `ultrathink/paperclip/adapters/{name}/LICENSE` | License | ✅ MIT |
| `@paperclipai/adapter-utils/dist` | `ultrathink/paperclip/adapter-utils/dist` | Code | ✅ Runtime |
| `~/.paperclip/instances/default` | `ultrathink/.paperclip-data/instances/default` (or preserve in place) | Data | ✅ ALL |

**Notes**:
- Skip `node_modules/` and `dist/**/*.map` (source maps).
- Do NOT vendor `@paperclipai/{server,db,adapter-*}/node_modules/` — rely on root `package.json` overrides.
- Skills: Copy all markdown files to `ultrathink/.claude/skills/paperclip/` with a README deduplicating references.
- Embedded data: Symlink or copy `~/.paperclip/instances/default` to a stable path for M1 migration snapshot.

---

## 10. Next Steps & Recommendations

### Immediate (Before M1 Merge)

1. **Finalize Dependency Strategy**
   - Decide: Option A (isolated) or Option B (integrated)?
   - If Option B, add pnpm overrides to root `package.json` now.

2. **Snapshot Embedded Data**
   ```bash
   cp -r ~/.paperclip/instances/default ./paperclip-snapshot-pre-merge/
   ```

3. **Validate License Compliance**
   - ✅ Confirmed all MIT. Add single CREDITS entry.

4. **Test Dependency Resolution**
   - Run `npm ls` after merge to detect conflicts.
   - Validate no duplicate major versions of critical deps (postgres, drizzle-orm, zod).

### During M1 Merge

1. **Vendor Source Files**
   - Use manifest in §9 above.
   - Create `ultrathink/paperclip/` directory structure.

2. **Merge package.json Dependencies**
   - Add Paperclip's deps to root `package.json` (if Option B).
   - Ensure overrides block are applied.

3. **Migrate Embedded Data**
   - Restore pre-merge snapshot into new UltraThink instance.
   - Validate Drizzle schema migration (check `db/dist/migrations/` for latest).

4. **Update .mcp.json**
   - Register Paperclip's MCP server (if extracting one from vendored server).
   - Update skill registry paths if copying skills.

5. **Integration Testing**
   - ✅ Adapter spawn tests (can we start a Claude worker?).
   - ✅ Plugin system tests (can we register + run a test plugin?).
   - ✅ Database tests (can we query entities from the migrated DB?).

### Post-M1 (Stabilization)

1. **Deduplication**
   - Run `npm dedupe` to collapse duplicate transitive deps.
   - Run `npm ls` to audit remaining conflicts.

2. **Skills Registry**
   - Merge Paperclip skill definitions into `.claude/skills/`.
   - Update documentation with Paperclip API reference links.

3. **UI Refactor Planning**
   - Decide whether vendored `ui-dist` is permanent or to be replaced.
   - If replacing, remove `server/ui-dist` to save ~2M.

4. **Performance Baseline**
   - Profile Paperclip server startup time with UltraThink config.
   - Identify any initialization bottlenecks (e.g., embedded-postgres spin-up if used).

---

## Executive Summary

**Paperclip is safe to vendor into UltraThink** with clear decision paths:

✅ **All 12 packages are MIT-licensed** and ready for merger.  
✅ **Total footprint is ~25MB** compiled, manageable for monorepo.  
✅ **Dependency conflicts are minimal** (postgres: 3.4.5 → 3.4.8, safe minor bump).  
✅ **Embedded data (~763M)** must be preserved via snapshot and migration strategy.  
✅ **Plugin system is well-defined** (event bus, SDK types, stdio RPC).  

**Three Critical Findings**:
1. Paperclip depends on **embedded-postgres@18.1.0-beta** (risky for production; recommend external DATABASE_URL).
2. UltraThink currently has NO express/drizzle/zod deps; adding them unifies the stack but increases surface area (recommend pnpm overrides).
3. Skills are duplicated across all 7 adapters; dedup them during vendoring to save ~500K and reduce registry clutter.

**Recommended Decision**: ✅ **PROCEED WITH M1 MERGE** using **Option B (Integrated)** with pnpm overrides. The risks are manageable with the outlined mitigation strategies. Conduct integration tests post-merge to validate plugin spawn and database migration.

---

**Report Generated**: 2026-04-26 17:30 UTC  
**Audit Scope**: Read-only analysis of @paperclipai packages in npm cache.  
**Next Review**: Post-M1 merge validation (2026-05-03 estimated).

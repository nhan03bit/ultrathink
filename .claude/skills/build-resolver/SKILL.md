---
name: build-resolver
description: Minimal-diff build error fixer — gets builds green with the smallest possible changes
layer: utility
category: quality
triggers:
  - "build error"
  - "build failed"
  - "tsc error"
  - "type error"
  - "build fix"
  - "compilation error"
  - "build broken"
inputs:
  - errors: "Build output or error messages"
  - scope: "Files to fix (default: all erroring files)"
outputs:
  - fixes: "Minimal edits that resolve all build errors"
  - verification: "Clean build confirmation"
linksTo:
  - fix
  - typescript-frontend
  - quality-gate
linkedFrom:
  - debug
  - cook
  - ship
preferredNextSkills:
  - quality-gate
  - test
fallbackSkills:
  - fix
  - debug
riskLevel: low
memoryReadPolicy: selective
memoryWritePolicy: selective
sideEffects:
  - "Modifies source files with minimal type/import fixes"
agentConfig:
  tools: ["Read", "Edit", "Bash", "Grep", "Glob"]
  model: sonnet
  isolation: true
---

# Build Resolver

## Purpose

Get a broken build passing with the absolute minimum changes. No refactoring,
no architecture changes, no improvements — just fix what's broken and verify.

This skill is designed to run as an **isolated agent** with its own context window,
so it can focus entirely on build errors without polluting the main conversation.

Use this when:
- `tsc --noEmit` reports errors after edits
- `npm run build` / `next build` fails
- CI pipeline breaks on type errors
- You need a quick fix without understanding the full context

## Key Concepts

### Minimal-Diff Philosophy

The build-resolver follows one rule: **smallest possible change that makes the build green**.

| DO | DON'T |
|---|---|
| Add type annotations | Refactor code structure |
| Add null checks (`?.`, `??`) | Rename variables |
| Fix import paths | Add new features |
| Add missing interface fields | Change business logic |
| Cast types when safe | "Improve" existing code |
| Add `@ts-expect-error` as last resort | Add comments or docs |

### Common Error → Fix Map

| Error Pattern | Fix |
|---|---|
| `implicitly has type 'any'` | Add explicit type annotation |
| `possibly 'undefined'` | Add optional chaining `?.` or nullish coalescing `??` |
| `Property 'X' does not exist on type 'Y'` | Add to interface or use type assertion |
| `Cannot find module 'X'` | Fix import path or install package |
| `Type 'X' is not assignable to type 'Y'` | Narrow type or add assertion |
| `Argument of type 'X' is not assignable` | Convert type at call site |
| `Module has no exported member 'X'` | Fix import name or add export |
| `Object is possibly 'null'` | Add null guard or `!` assertion |
| `'X' is declared but never used` | Remove unused variable/import |
| `Cannot use JSX unless '--jsx' flag is provided` | Check tsconfig.json jsx setting |

### Last Resort Hierarchy

When a clean fix isn't obvious:

1. **Type narrowing** — `if (x !== undefined)` guard
2. **Type assertion** — `as SomeType` at usage site
3. **Partial type** — `Partial<Interface>` or `Record<string, unknown>`
4. **Suppress** — `// @ts-expect-error <reason>` (document why)

Never use `// @ts-ignore` — always use `@ts-expect-error` which will fail if the error is fixed.

## Workflow

### Phase 1: Collect All Errors

```bash
# Run full typecheck, capture all errors
npx tsc --noEmit 2>&1 | tee /tmp/build-errors.txt

# Count and categorize
grep -c 'error TS' /tmp/build-errors.txt
# Group by error code
grep -oP 'error TS\d+' /tmp/build-errors.txt | sort | uniq -c | sort -rn
```

### Phase 2: Prioritize by Dependency

Fix errors in dependency order — fixing a type definition error may cascade-fix
downstream usage errors:

1. **Shared types** (`types.ts`, `interfaces.ts`) — fix first
2. **Library code** (`lib/`, `utils/`) — fix second
3. **Components/routes** — fix last (often resolved by steps 1-2)

### Phase 3: Fix with Minimal Changes

For each error:
1. Read the file at the error line
2. Identify the minimal fix from the Error → Fix Map
3. Apply the edit
4. Do NOT read surrounding code or "improve" anything

### Phase 4: Verify

```bash
# Re-run typecheck
npx tsc --noEmit 2>&1

# If clean, run build
npm run build

# Verify no new errors were introduced
git diff --stat  # Should show minimal changes
```

### Phase 5: Report

```
BUILD RESOLVER: ✅ FIXED

  Errors found:  8
  Errors fixed:  8
  Files changed: 3
  Lines changed: 12

  Changes:
    src/lib/db.ts        +2 lines (type annotations)
    src/api/users.ts     +5 lines (null checks)
    src/types/index.ts   +5 lines (missing interface fields)
```

## Best Practices

1. **Fix all errors in one pass** — collect everything before starting fixes
2. **Fix types before usage** — shared definitions first, consumers second
3. **Prefer narrowing over assertion** — `if (x)` is safer than `as NonNull`
4. **Never change logic** — if a fix requires understanding business logic, escalate to `fix` skill
5. **Verify after every batch** — re-run tsc after fixing each file to catch cascades
6. **Track lines changed** — if you're changing >5% of a file, you're doing too much
7. **Use `@ts-expect-error` over `any`** — it's self-documenting and self-removing

## Common Pitfalls

| Pitfall | Impact | Fix |
|---------|--------|-----|
| Fixing symptoms not causes | More errors appear | Fix type definitions first, then usages |
| Using `any` to silence errors | Hides real bugs | Use specific types or `unknown` with guards |
| Changing function signatures | Breaks callers | Add overloads or fix callers instead |
| Ignoring cascading fixes | Fixing 1 error fixes 5 others | Re-run tsc after each file's fixes |
| Over-fixing | Unnecessary changes in diff | Stop as soon as build passes |
| Missing transitive deps | `Cannot find module` | Check tsconfig paths and package.json |

## Examples

### Fixing a Type Mismatch

```typescript
// ERROR: Type 'string | undefined' is not assignable to type 'string'
// BEFORE:
const name = user.name;
// AFTER (minimal fix):
const name = user.name ?? "";
```

### Fixing Missing Interface Field

```typescript
// ERROR: Property 'email' does not exist on type 'User'
// BEFORE:
interface User { id: string; name: string; }
// AFTER:
interface User { id: string; name: string; email: string; }
```

### Fixing Import Error

```typescript
// ERROR: Module '"@/lib/db"' has no exported member 'query'
// BEFORE:
import { getDb, query } from "@/lib/db";
// AFTER:
import { getDb } from "@/lib/db";
// (query was removed — check if it's used, remove usage too)
```

## Agent Configuration

When invoked as a subagent (via the Agent tool), build-resolver should:
- Receive the build error output as context
- Have access to: Read, Edit, Bash, Grep, Glob
- Run on Sonnet (implementation task, not planning)
- Return: list of files changed, lines changed, verification status

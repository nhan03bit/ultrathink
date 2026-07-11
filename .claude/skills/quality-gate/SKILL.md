---
name: quality-gate
description: Lightweight post-edit verification pipeline — format, lint, typecheck, test in one pass
layer: utility
category: quality
triggers:
  - "quality gate"
  - "quality check"
  - "run checks"
  - "lint and test"
  - "pre-commit check"
  - "verify changes"
  - "check my code"
inputs:
  - path: "File or directory to check (default: changed files)"
  - mode: "quick (format+type) | full (all checks) | strict (fail on warnings)"
outputs:
  - report: "Pass/fail status per check with remediation list"
  - verdict: "PASS | WARNING | BLOCK"
linksTo:
  - code-review
  - test
  - fix
  - audit
linkedFrom:
  - cook
  - ship
  - verify
preferredNextSkills:
  - fix
  - code-review
fallbackSkills:
  - audit
riskLevel: low
memoryReadPolicy: none
memoryWritePolicy: selective
sideEffects:
  - "May auto-fix formatting issues with --fix flag"
---

# Quality Gate

## Purpose

Run a fast, automated verification pipeline on changed files before committing or
opening a PR. Unlike a full audit, quality-gate is lightweight and targeted — it
checks only what changed and gives a pass/fail verdict in seconds.

Use this when:
- You just finished implementing a feature
- Before creating a commit or PR
- After a refactor to confirm nothing broke
- As a quick sanity check mid-development

## Key Concepts

### Check Pipeline (executed in order, stops on BLOCK)

| Step | Tool | Scope | Blocks on |
|------|------|-------|-----------|
| 1. Format | Biome / Prettier | Changed files | Never (auto-fixes) |
| 2. Typecheck | `tsc --noEmit` | Project-wide | Any error |
| 3. Lint | Biome / ESLint | Changed files | Error-level rules |
| 4. Test | vitest / jest / pytest | Affected tests | Any failure |
| 5. Console.log | grep | Changed `.ts/.tsx` | In strict mode |
| 6. Secrets | grep patterns | Changed files | Any match |

### Modes

- **quick** — Format + Typecheck only (2-5 seconds)
- **full** — All 6 checks (default, 10-30 seconds)
- **strict** — All checks, warnings become blockers

### Verdict Logic

```
BLOCK  — Any check failed (typecheck error, test failure, secret detected)
WARNING — Non-critical issues (console.log found, lint warnings)
PASS   — All checks green
```

## Workflow

### Phase 1: Detect Changed Files

```bash
# Get changed files (staged + unstaged)
git diff --name-only HEAD
git diff --cached --name-only
# Filter to relevant extensions
grep -E '\.(ts|tsx|js|jsx|py|go|rs)$'
```

### Phase 2: Run Checks

Execute checks sequentially. If a BLOCK-level check fails, report immediately
but continue remaining checks to give a complete picture.

```bash
# 1. Format (auto-fix)
npx biome format --write <files>   # or prettier --write

# 2. Typecheck
npx tsc --noEmit 2>&1 | grep -E '<changed-files>'

# 3. Lint
npx biome lint <files>             # or eslint <files>

# 4. Test (find affected test files)
npx vitest run --reporter=verbose --changed

# 5. Console.log audit
grep -rn 'console\.log' <changed-ts-files> | grep -v '\.test\.'

# 6. Secret patterns
grep -rn -E '(sk-|AKIA|ghp_|password\s*=)' <changed-files>
```

### Phase 3: Report

Output a concise table:

```
QUALITY GATE: [PASS|WARNING|BLOCK]

  Format    ✅ 3 files formatted
  Typecheck ✅ Clean
  Lint      ⚠️  2 warnings (no-unused-vars)
  Tests     ✅ 14/14 passed
  Logs      ⚠️  1 console.log in api/route.ts:42
  Secrets   ✅ Clean

  Verdict: WARNING — review console.log before PR
```

### Phase 4: Remediation

For each failed check, provide the exact fix:
- Typecheck errors: file:line with error message
- Lint issues: rule name + auto-fix command if available
- Test failures: test name + assertion that failed
- Secrets: file:line with the pattern matched

## Best Practices

1. **Run quality-gate before every commit** — catches issues while context is fresh
2. **Use quick mode during development** — full mode before PR only
3. **Auto-fix formatting silently** — never block on style, just fix it
4. **Filter checks to changed files** — don't report pre-existing issues
5. **Stop on secrets immediately** — never let credentials reach git history
6. **Report all issues at once** — don't stop at first failure, give the complete picture
7. **Track pass rates** — log verdicts to memory for session analytics

## Common Pitfalls

| Pitfall | Impact | Fix |
|---------|--------|-----|
| Running full project typecheck | Slow, reports unrelated errors | Filter tsc output to changed files only |
| Blocking on lint warnings | Slows development cycle | Only block on error-level rules |
| Missing test detection | Changed code has untested paths | Use vitest --changed or jest --findRelatedTests |
| Ignoring console.log in tests | Test files legitimately use console | Exclude `.test.` and `.spec.` files |
| Secret false positives | `sk-` in variable names like `taskId` | Use word-boundary patterns, check context |
| Not auto-fixing format | Developer wastes time on style | Always format --write, never just check |

## Examples

### Quick Check After Edit

```
> quality-gate src/lib/auth.ts --quick

QUALITY GATE: PASS
  Format    ✅ 1 file (no changes needed)
  Typecheck ✅ Clean
```

### Full Check Before PR

```
> quality-gate . --full

QUALITY GATE: BLOCK
  Format    ✅ 5 files formatted
  Typecheck ❌ 2 errors
    src/api/users.ts(34,5): error TS2322: Type 'string' is not assignable to type 'number'
    src/lib/cache.ts(12,3): error TS2345: Argument of type 'undefined' is not assignable
  Lint      ✅ Clean
  Tests     ❌ 1 failure
    FAIL src/api/users.test.ts > createUser > validates email format
      Expected: true, Received: false
  Logs      ✅ Clean
  Secrets   ✅ Clean

  Verdict: BLOCK — fix 2 type errors and 1 test failure
```

## Integration with Hooks

Quality-gate can run automatically via PostToolUse hook on `Edit|Write`:

```bash
# In quality-gate-hook.sh (PostToolUse)
# Only runs in "full" mode when explicitly requested
# The lighter format-check.sh and post-edit-typecheck.sh hooks
# handle the "quick" checks automatically after every edit
```

The existing hooks already cover steps 1-2 of the pipeline:
- `format-check.sh` → Format check (PostToolUse)
- `post-edit-typecheck.sh` → TypeScript check (PostToolUse)

Quality-gate adds steps 3-6 as an on-demand verification pass.

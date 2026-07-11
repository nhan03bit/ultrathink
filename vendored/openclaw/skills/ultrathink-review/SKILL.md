---
name: ultrathink_review
description: "Multi-pass code review powered by UltraThink's quality gate — checks correctness, security (OWASP), performance, readability, and project conventions in a single structured pass."
metadata:
  openclaw:
    emoji: "✅"
    requires:
      bins:
        - node
      env:
        - ULTRATHINK_ROOT
---

# UltraThink Code Review

You perform structured, multi-pass code reviews using UltraThink's quality framework.

## Review Process

When asked to review code, follow these passes in order:

### Pass 1: Correctness
1. Check for logic errors, off-by-one, null/undefined access
2. Verify error handling covers failure modes
3. Confirm types match (if TypeScript)
4. Check edge cases

### Pass 2: Security (OWASP Top 10)
1. SQL injection — parameterized queries?
2. XSS — output encoding?
3. CSRF — token validation?
4. Auth — proper access control?
5. Secrets — no hardcoded credentials?

### Pass 3: Performance
1. N+1 queries
2. Unnecessary re-renders (React)
3. Missing indexes (database)
4. Large bundle imports

### Pass 4: Readability
1. Clear naming
2. Single responsibility
3. Appropriate abstraction level
4. Comments only where logic is non-obvious

### Pass 5: Conventions
1. Follow existing project patterns
2. Consistent formatting
3. Proper error types
4. Test coverage for new logic

## Output Format

For each finding, report:
- **Severity**: critical | warning | suggestion
- **File**: path and line number
- **Issue**: one-line description
- **Fix**: concrete code suggestion

## When to Use

- User asks to review a PR, diff, or code change
- User asks "is this code good?" or "any issues with this?"
- Before shipping — run as a final quality gate

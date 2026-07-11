---
name: ultrathink_code_intel
description: "Cross-file code intelligence — symbol search, dependency graphs, impact analysis, and semantic module clustering powered by AST parsing and Postgres."
metadata:
  openclaw:
    emoji: "🔍"
    requires:
      bins:
        - node
      env:
        - DATABASE_URL
        - ULTRATHINK_ROOT
    primaryEnv: DATABASE_URL
---

# UltraThink Code Intelligence

You have access to UltraThink's code intelligence system — deterministic, AST-based
code knowledge that never decays.

## Available Tools

Use the `ultrathink-code-intel` MCP server tools:

### code-symbols
Search symbol definitions by name, pattern, or kind.
- Input: `{ "query": "string", "kind": "function|class|interface|type|variable", "limit": 20 }`
- Returns: Symbol name, kind, file path, line number, signature

### code-deps
Outgoing edges — what does a symbol import, call, or extend?
- Input: `{ "symbol": "string", "file": "string" }`
- Returns: List of dependencies with edge types (imports, calls, extends, implements)

### code-dependents
Incoming edges — what calls, imports, or uses this symbol?
- Input: `{ "symbol": "string", "file": "string" }`
- Returns: List of dependents with edge types

### code-impact
Transitive dependents up to N hops — "what breaks if I change X?"
- Input: `{ "symbol": "string", "file": "string", "hops": 3 }`
- Returns: Impact tree showing all affected symbols and files

## When to Use

1. **Before refactoring** — Run `code-impact` to understand blast radius
2. **Exploring unfamiliar code** — Use `code-symbols` to find entry points
3. **Debugging** — Trace call chains with `code-deps` and `code-dependents`
4. **Code review** — Verify that changes don't break downstream consumers

## Token Efficiency

Querying the code graph costs ~200 tokens vs reading files (~3000+ tokens each).
Always prefer graph queries over file reads when you need structural information.

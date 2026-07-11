---
name: ultrathink_memory
description: "Persistent memory system for UltraThink — search, save, and recall project context, decisions, and patterns across sessions using Postgres-backed fuzzy search with synonym expansion."
metadata:
  openclaw:
    emoji: "💾"
    requires:
      bins:
        - node
        - npx
      env:
        - DATABASE_URL
        - ULTRATHINK_ROOT
    primaryEnv: DATABASE_URL
---

# UltraThink Memory

You have access to UltraThink's persistent memory system backed by Neon Postgres.

## Available Tools

Use the `ultrathink-memory` MCP server tools:

### memory-search
Search existing memories by keyword or semantic query.
- Input: `{ "query": "string", "scope": "project|global", "limit": 10 }`
- Returns: Matching memories with content, importance, confidence, and timestamps

### memory-save
Save a new memory for future sessions.
- Input: `{ "content": "string", "importance": 1-10, "confidence": 0-1, "scope": "project|global", "tags": ["string"] }`
- Use importance 7+ for critical decisions, 4-6 for useful context, 1-3 for minor notes

### memory-recall
Recall all memories for the current project scope.
- Input: `{ "scope": "project", "limit": 50 }`
- Returns: All active memories sorted by importance

## When to Use

1. **Start of conversation** — Search memory for relevant project context
2. **After key decisions** — Save architectural choices, trade-off rationale
3. **After debugging** — Save root cause and fix for future reference
4. **User corrections** — Save feedback as high-importance memories

## Rules

1. Read before write — always search before saving to avoid duplicates
2. Be selective — not every interaction needs a memory
3. Include rationale — "we chose X because Y" is more valuable than just "we used X"
4. Tag consistently — use project name, technology, and category tags

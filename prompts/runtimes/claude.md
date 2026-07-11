## Claude Runtime Overlay

- Keep `~/.claude/CLAUDE.md`, `~/.claude/skills`, `~/.claude/references`, `~/.claude/agents`, and `~/.claude/hooks/ultrathink-*` active.
- Load `CLAUDE.md`, `AGENTS.md`, and the relevant global instruction file before non-trivial work.
- Use Claude Code hooks and MCP tools when available.
- Use `TaskCreate` and `TaskUpdate` only in runtimes that expose those tools; otherwise keep task state in the response and work sequentially.

## Claude-Specific Notes

- VFS is mandatory for code exploration when `mcp__vfs__extract` is available.
- Memory MCP tools are first-class when registered; otherwise use the documented CLI commands.
- Do not duplicate canonical shared instructions here. Update `prompts/core.md` and run `npm run prompts:sync`.

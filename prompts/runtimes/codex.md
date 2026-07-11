## Codex Runtime Overlay

- Keep `~/.codex/AGENTS.md`, `~/.codex/config.toml`, and `~/.codex/hooks.json` linked to this repository unless the user explicitly asks otherwise.
- Load `AGENTS.md`, `CLAUDE.md`, and the relevant global instruction file before non-trivial work.
- Prefer non-interactive git and shell commands.
- Use available file/search/edit tools directly; if VFS tools are unavailable, use targeted `Glob`, `Grep`, and `Read` calls.

## Codex Runtime Mapping

| Claude Code | Codex CLI |
|-------------|-----------|
| `CLAUDE.md` | `AGENTS.md` |
| `.claude/settings.json` | `.codex/config.toml` |
| `.claude/hooks/*.sh` | `.codex/hooks.json` |
| `.mcp.json` | `.codex/config.toml` `[mcp_servers]` |

## Codex-Specific Notes

- Do not duplicate canonical shared instructions here. Update `prompts/core.md` and run `npm run prompts:sync`.

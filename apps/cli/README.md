# `ut` — UltraThink terminal CLI

Drive your bipartite team from the shell. Talks to:

- **Paperclip** REST (`PAPERCLIP_API_URL`, default `http://127.0.0.1:3100`) for agents, issues, comments.
- **UltraThink Neon** (`DATABASE_URL`) for memory + design-doc review/approval state.

All actor names render through `formatActor` so agents print as `Name [Title]`.

## Install

```bash
cd /path/to/ultrathink/apps/cli
pnpm install
pnpm build
pnpm link --global
```

After that `ut` is on your `PATH` (assuming `~/Library/pnpm` or pnpm's bin dir is in `PATH`).

## Env

`apps/cli/src/config.ts` auto-loads `<repo>/.env`. Required:

| Var | Default |
|---|---|
| `PAPERCLIP_API_URL` | `http://127.0.0.1:3100` |
| `PAPERCLIP_COMPANY_ID` | `230c703d-eb8b-4872-aad9-9b3495eb6d59` |
| `DATABASE_URL` | (Neon connection string) |
| `PAPERCLIP_DIRECTOR_AGENT_ID` | Steven's UUID |

## Commands

### Agents

```bash
ut agent list                                  # table: name | role | status | budget | last hb
ut agent show steven                           # full detail
ut agent ask steven "review the new gate plan" # creates issue, wakes Steven, polls 5min
ut agent ask mira "ship M7 polish" --no-wait   # fire-and-forget
ut agent wake quinn --reason "qa sweep"
```

### Issues

```bash
ut issue list                                  # all
ut issue list --assignee steven --status todo  # filtered
ut issue list --project ultrathink-oss
ut issue show INU-42                           # full thread + design-doc state
ut issue create "Polish dashboard" --assign mira --project ultrathink-oss
ut issue comment INU-42 "shipped"
ut issue assign INU-42 quinn
ut issue status INU-42 in_review
```

### Design-doc

```bash
ut design-doc get INU-42                       # latest revision body + lane verdicts
ut design-doc review INU-42 --lane code --verdict approve --comment "lgtm"
ut design-doc approve INU-42                   # requires all 3 lanes = approve
```

### Memory

```bash
ut memory search "design-doc"
ut memory recall --scope agent --limit 5
ut memory save "Use bracket convention for all actors" \
  --scope knowledge/decisions --category decision --importance 8 --layer 1
```

### Team rituals (M8 placeholders)

```bash
ut team standup                                # today's open work by assignee
ut team retro                                  # last 7 days: done / blocked / touched
```

### Interactive chat (REPL)

```bash
ut chat                    # interactive REPL — talk to one or many agents
ut talk                    # alias
ut chat --dry-run          # parse & echo with no Paperclip writes (useful for sanity-testing)
ut chat --poll-ms 3000     # tighten the agent-reply poll interval (default 5000)
```

Sample session:

```text
$ ut chat
ut chat — type /help for commands, /quit to exit
ut> @steven scope a CMS for InuVerse
  → created INU-25 → Steven [CEO]
[Steven [CEO]] (INU-25) what stack? what timeline?
ut> next.js + postgres, ship in 4 weeks
  → comment posted on INU-25
[Steven [CEO]] (INU-25) doc rev 1 posted. routing to integrators.
ut> @mira review rev 1 on INU-25
  → created INU-26 → Mira [Code Integrator]
[Mira [Code Integrator]] (INU-26) approved on rev 1 — clean dep graph.
ut> /quit
```

#### Slash commands

| Command | What it does |
|---|---|
| `/help` (or `/?`) | Show command + mention syntax |
| `/agents` | List active conversations (active issue marked with `*`) |
| `/status` | Table of all agents — status, last heartbeat, MTD spend |
| `/issue <INU-N>` | Set the active issue context (plain-text replies go here) |
| `/issue` | Show the current active issue |
| `/quit` (or `/q`, `/exit`) | Exit chat |

#### Mention parsing

- `@<name> <message>` — start a thread (new issue) with that agent, or comment on the existing thread
- `@<a> ... @<b> ...` — fan out: both agents are dispatched in parallel
- `<plain text>` (no `@`) — comment on the active issue
- Names are alphanumeric + `-_`, matched against agent name and `urlKey` (case-insensitive, prefix-OK)
- Empty message after a mention is rejected (won't waste an agent wake)

Agent replies arrive asynchronously: each in-flight thread runs a poll loop and prints replies as they come in, redrawing the prompt below them. No TUI dep — plain stdout interleaving.

### Top-level shortcut

```bash
ut ask steven "..."        # alias for `ut agent ask steven "..."`
```

### Flags

- `--json` on read commands emits machine-readable JSON.
- `UT_DEBUG=1` prints stack traces on failure.

## Output conventions

- Agent name is colored by role: CEO (magenta), CTO/Code (cyan), QA (yellow), DevOps (green), Engineer (blue).
- Status badges are colored: `todo` cyan, `in_progress` blue, `in_review` magenta, `done` green, `blocked` red.
- All actor names print as `Name [Title]` via the same helper as `dashboard/lib/actor.ts`.

## Development

```bash
pnpm dev            # tsc -b --watch
node dist/index.js agent list   # run without re-linking
```

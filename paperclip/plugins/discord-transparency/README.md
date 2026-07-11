# @paperclipai/plugin-discord-transparency

Stream meaningful Paperclip events (issues, agents, runs, costs, design docs) to
Discord channel webhooks. Built on the `@paperclipai/plugin-sdk` worker entry
point.

## What it does

Subscribes to Paperclip's domain events and posts a structured embed per event
to one or more Discord channels:

| Event                       | Channel(s)             | Color   | Notes                                       |
| --------------------------- | ---------------------- | ------- | ------------------------------------------- |
| `issue.created`             | `#feed` + actor lane   | gray    |                                             |
| `issue.completed`           | `#feed` + actor lane   | green   |                                             |
| `issue.blocked`             | `#alerts` + actor lane | amber   | Pings director (config: `directorMention`). |
| `document.created`          | `#design-docs`         | blue    |                                             |
| `document.reviewed`         | `#design-docs`         | varies  | green=approve, amber=changes, red=block.    |
| `document.approved`         | `#design-docs`         | green   |                                             |
| `agent.run.finished`        | `#feed` (if expensive) | gray    | Suppressed below `minRunCostUsd`.           |
| `agent.error` / `run.failed`| `#alerts` + actor lane | red     | Pings director.                             |
| `budget.threshold`          | `#alerts` + actor lane | amber   | Pings director.                             |

Actor lanes:
- Agent actor (`Name [Title]`) → also `#agents`
- Human actor (`Name`) → also `#humans`
- `triggerType: "human_mention"` → also `#human→agent`

## Configure

Webhook URLs come from **plugin config** OR **environment variables**. Env vars
win, so operators can override per-deployment without rebuilding.

| Channel         | Plugin config key       | Env var                          |
| --------------- | ----------------------- | -------------------------------- |
| `#feed`         | `webhooks.feed`         | `DISCORD_WEBHOOK_FEED`           |
| `#agents`       | `webhooks.agents`       | `DISCORD_WEBHOOK_AGENTS`         |
| `#humans`       | `webhooks.humans`       | `DISCORD_WEBHOOK_HUMANS`         |
| `#human→agent`  | `webhooks.humanAgent`   | `DISCORD_WEBHOOK_HUMAN_AGENT`    |
| `#alerts`       | `webhooks.alerts`       | `DISCORD_WEBHOOK_ALERTS`         |
| `#design-docs`  | `webhooks.designDocs`   | `DISCORD_WEBHOOK_DESIGN_DOCS`    |

Other config:

- `minRunCostUsd` (number, default `0.5`) — suppress `agent.run.finished`
  embeds below this cost. Override via `DISCORD_MIN_RUN_COST_USD`.
- `directorMention` (string, default `""`) — Discord ID injected on alerts.
  Use `123` for a user, `&123` for a role. Override via
  `DISCORD_DIRECTOR_MENTION`.

If a channel has no webhook configured, the plugin **logs the embed payload
instead of posting**. This makes it safe to install without immediately wiring
all six channels.

## Develop

```bash
pnpm --filter @paperclipai/plugin-discord-transparency typecheck
pnpm --filter @paperclipai/plugin-discord-transparency build
pnpm --filter @paperclipai/plugin-discord-transparency test
```

Smoke test (posts a synthetic `issue.created` to `#feed`, or logs the payload
when no webhook is configured):

```bash
pnpm --filter @paperclipai/plugin-discord-transparency test:emit
# or:
DISCORD_WEBHOOK_FEED="https://discord.com/api/webhooks/..." \
  pnpm --filter @paperclipai/plugin-discord-transparency test:emit
```

## Register with Paperclip

Plugins install through Paperclip's plugin loader. Pick whichever path matches
your runtime:

### A. Local-path install (development)

1. Build the plugin: `pnpm --filter @paperclipai/plugin-discord-transparency build`.
2. From your running Paperclip Board UI:
   - Open **Settings → Plugins → Install plugin**
   - Choose **From local path** and point at this directory:
     `paperclip/plugins/discord-transparency`
3. Set the webhook URLs in the plugin's settings page (the auto-generated form
   driven by `manifest.json`'s `config.schema`), or export the
   `DISCORD_WEBHOOK_*` env vars before starting Paperclip.

### B. npm-package install (production)

1. Publish this package to a registry the Paperclip instance can reach.
2. Use **Settings → Plugins → Install plugin → From npm** in the Board UI.
3. Configure secrets via env vars or the plugin's settings page.

### C. CLI / config file

The host loader reads the manifest from the plugin entry on startup. If your
deployment registers plugins via `~/.paperclip/instances/<name>/config.json`,
add an entry under `plugins` that points to the absolute path of this
directory. The exact CLI command depends on your Paperclip version — see the
host's plugin SDK docs (`paperclip/plugin-sdk/README.md`) for the loader
contract.

## Synthetic events (activity_log bridge)

Some Paperclip events the routing table cares about — `issue.completed`,
`issue.blocked`, `document.created/reviewed/approved`, `agent.error`,
`budget.threshold`, `heartbeat_run.completed` — are **not** emitted on the
live plugin event bus. They are derived from rows written to the
`activity_log` table. The plugin bridges them via `src/poller.ts`.

### How it works

The plugin SDK's `ctx.activity` is **write-only** (`PluginActivityClient.log()`).
There is no list/poll API. Paperclip *does* however publish a first-class
`"activity.logged"` plugin event for every activity_log insertion (see
`paperclip/server/.../activity-log.js`). On `setup()`, the plugin
subscribes to `activity.logged`, extracts the `(action, entityType)` pair
from the event, and translates it to a synthetic event name via
`src/activity-mapper.ts`. Recognized rows are then dispatched through the
same `dispatchEvent()` pipeline as live events.

### Mapping table

| activity_log row                                    | Synthetic event           |
| --------------------------------------------------- | ------------------------- |
| `action="issue.completed"`, `entityType="issue"`    | `issue.completed`         |
| `action="issue.blocked"`,   `entityType="issue"`    | `issue.blocked`           |
| `action="document.created"`,`entityType="document"` | `document.created`        |
| `action="document.reviewed"`,`entityType="document"`| `document.reviewed`       |
| `action="document.approved"`,`entityType="document"`| `document.approved`       |
| `action="agent.error"`,     `entityType="agent"`    | `agent.error`             |
| `action="budget.threshold"`,`entityType="budget"`   | `budget.threshold`        |
| `action="heartbeat_run.completed"`                  | `heartbeat_run.completed` |

Bare verbs are also accepted when `entityType` disambiguates them
(e.g. `action="completed"` + `entityType="issue"` → `issue.completed`).

### Tuning the cadence

The bridge is push-driven, not interval-driven. Paperclip emits each row
to plugins as it is written, so there is no polling interval to tune. If
a future SDK release adds `ctx.activity.list({ since })`, swap the
subscription for an `setInterval` loop with the same cursor semantics.

### Resetting the cursor

The bridge persists `{ lastEventId, lastSeenAt }` to plugin state under
`(scopeKind: "instance", stateKey: "activity-cursor")` for replay
deduplication. To force the next event through unconditionally:

```ts
await ctx.state.set(
  { scopeKind: "instance", stateKey: "activity-cursor" },
  { lastEventId: null, lastSeenAt: new Date(0).toISOString() }
);
```

## What's deferred

This is a scaffold; a follow-up subagent will:

- Cover the long tail of events (approvals, comments, workspace events,
  goal lifecycle, plugin-emitted events).
- Persist a retry queue (currently single-retry on 429, no persistent backoff).
- Read webhook URLs through `ctx.secrets` instead of env / config.
- De-dupe noisy events using `ctx.state` (e.g. don't repost the same blocker
  every minute while it's still blocked).
- Switch the activity bridge to a true poller if the SDK ever exposes
  `ctx.activity.list()` — the cursor scaffolding in `poller.ts` is ready.
- Publish to npm + add the plugin to the bundled examples list in
  `server/src/routes/plugins.ts`.

## Layout

```
paperclip/plugins/discord-transparency/
├── manifest.json                ← capabilities + config schema
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                 ← worker entry; definePlugin + runWorker
│   ├── format-actor.ts          ← server-side mirror of UI helper
│   ├── embed-builder.ts         ← event → DiscordEmbed
│   ├── event-router.ts          ← event → channels + alert mention
│   ├── webhook-client.ts        ← per-channel queue, 429 handling
│   ├── activity-mapper.ts       ← activity_log row → synthetic envelope
│   ├── poller.ts                ← `activity.logged` subscriber + cursor
│   └── config.ts                ← env + config merge (Zod)
├── tests/
│   ├── embed-builder.test.ts    ← unit tests for builder + router
│   └── activity-mapper.test.ts  ← unit tests for synthetic mapping
└── scripts/
    └── test-emit.ts             ← smoke test (post or log)
```

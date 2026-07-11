# @inuverse/transparency

Ingestion plugin: Paperclip event bus → UltraThink `activity_log` table → Discord fan-out.

## Responsibilities

1. Subscribe to Paperclip's event bus (M4 wires the actual subscriber).
2. Transform each Paperclip event into an `activity_log` row.
3. Insert via the Neon serverless client (single source of truth).
4. Fan out a formatted notification to Discord (M4).

## What's here today (M7 scaffold)

- `src/types.ts` — `PaperclipEvent` discriminated union covering issue.\*, document.\*,
  heartbeat_run.\*, budget.\*, agent.\* events.
- `src/log-activity.ts` — `recordActivity(event)`: maps a `PaperclipEvent` onto an
  `activity_log` row and runs the INSERT against Neon.
- `src/index.ts` — entry point. Re-exports `recordActivity` and a `subscribe()` stub
  that M4 will hook up to the Paperclip event bus.

## What M4 will add

- Real `subscribe()` implementation against the Paperclip event bus.
- Discord webhook posting (currently a no-op stub inside `recordActivity`).
- Retry / dead-letter handling for failed inserts.

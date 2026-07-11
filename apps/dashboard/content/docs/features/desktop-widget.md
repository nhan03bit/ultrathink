# Desktop Widget

A macOS Ubersicht widget that displays UltraThink system status on your desktop.

## What it Shows

- **Anthropic API usage** -- 5-hour and 7-day quota consumption
- **Active session stats** -- Current session duration and activity
- **Memory count** -- Total persistent memories
- **Token costs** -- Running cost for the current session

## Requirements

- macOS with [Ubersicht](http://tracesof.net/uebersicht/) installed
- UltraThink running with a valid `DATABASE_URL`

## Installation

The widget lives in `widgets/` in the UltraThink project. Copy or symlink it to your Ubersicht widgets directory:

```bash
ln -s /path/to/ultrathink/widgets/ultrathink.widget ~/Library/Application\ Support/Ubersicht/widgets/
```

## Configuration

The widget reads from the same `DATABASE_URL` and UltraThink APIs as the rest of the system. No additional configuration is needed.

The widget refreshes automatically on a regular interval to keep quota and session data current.

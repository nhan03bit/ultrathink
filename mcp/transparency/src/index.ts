// intent: Entry point for @inuverse/transparency.
// status: scaffold (M7) — subscribe() is a stub.
// next: M4 wires subscribe() to the Paperclip event bus.
// confidence: high

import { recordActivity } from "./log-activity.js";
import type { PaperclipEvent } from "./types.js";

export { recordActivity };
export * from "./types.js";

/**
 * Subscribe to Paperclip's event bus and stream every event into recordActivity().
 *
 * M4 will:
 *  - replace this stub with the real bus subscriber (NATS / Redis Streams / etc.)
 *  - add backoff / DLQ on insert failures
 *  - emit Discord webhook posts (currently no-op inside log-activity.ts)
 *
 * Returns an unsubscribe function so callers can stop the stream cleanly.
 */
export async function subscribe(_onEvent?: (event: PaperclipEvent) => Promise<void>): Promise<() => Promise<void>> {
  // intent: stub — M4 replaces with real event-bus client.
  // status: blocked (waiting on M4 bus selection)
  // confidence: low
  console.warn("[transparency] subscribe() is a stub. M4 will wire this up to the Paperclip event bus.");

  return async () => {
    // no-op unsubscribe
  };
}

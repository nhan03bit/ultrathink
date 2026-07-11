// intent: Discord user ID → HumanIdentity resolver with reconnect-coalescing.
//   Per doc rev 2 step 19 (Quinn's note): if a guild member triggers a reconnect
//   while an in-flight resolve is already pending for the same discordId, the
//   second caller MUST await the same promise rather than issuing a duplicate
//   HTTP round-trip to ut-bridge.  Implementation: per-userId in-flight Map that
//   is cleared as soon as the promise settles.
//
//   A TTL-based positive-hit cache (5 min, matching ut-bridge's own TTL) sits on
//   top of the coalescing layer to avoid redundant lookups between reconnects.
//
//   Unknown users (404 from ut-bridge) are cached for 30 s to rate-limit
//   repeated lookups from the same unmapped Discord user, consistent with the
//   bot's 1×/(user, hour) "not registered" reply policy.
// status: done
// confidence: high

import { getHumanByDiscordId, type HumanIdentity } from "./ut-bridge-client.js";

export type { HumanIdentity };

const HIT_TTL_MS = 5 * 60 * 1000;
const MISS_TTL_MS = 30 * 1000;

interface CacheEntry {
  value: HumanIdentity | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<HumanIdentity | null>>();

export function resolveIdentity(discordId: string, utBridgeUrl: string): Promise<HumanIdentity | null> {
  // Cache hit?
  const cached = cache.get(discordId);
  if (cached && Date.now() < cached.expiresAt) {
    return Promise.resolve(cached.value);
  }

  // Already in-flight for this discordId? Coalesce.
  const existing = inflight.get(discordId);
  if (existing) return existing;

  const p = getHumanByDiscordId(discordId, utBridgeUrl).then(
    (identity) => {
      inflight.delete(discordId);
      cache.set(discordId, {
        value: identity,
        expiresAt: Date.now() + (identity ? HIT_TTL_MS : MISS_TTL_MS),
      });
      return identity;
    },
    (err) => {
      inflight.delete(discordId);
      throw err;
    }
  );

  inflight.set(discordId, p);
  return p;
}

// Exposed for tests and force-refresh after a human row is updated.
export function invalidateIdentityCache(discordId?: string): void {
  if (discordId) {
    cache.delete(discordId);
  } else {
    cache.clear();
  }
}

export function __getInflightMapForTests(): Map<string, Promise<HumanIdentity | null>> {
  return inflight;
}

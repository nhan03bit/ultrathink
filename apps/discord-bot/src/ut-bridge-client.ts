// intent: thin HTTP wrapper around ut-bridge for the discord-bot. Two concerns:
//   1. probeHealth(url) — the T+0/T+2s boot probe factored out of index.ts (step 18).
//      index.ts calls this directly; the extract is here so integration tests can
//      swap the url without patching process.env.
//   2. getHumanByDiscordId(discordId, url) — calls GET /humans/by-discord/:id,
//      returns the identity shape or null (404) or throws on network / >=500.
//      Used by identity.ts resolver (reconnect-coalescing lives there, not here).
// status: done
// confidence: high

export interface HumanIdentity {
  humanId: string;
  paperclipUserId: string | null;
  name: string;
  isActive: boolean;
}

const PROBE_TIMEOUT_MS = 1500;
const PROBE_RETRY_DELAY_MS = 2000;

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function probeHealth(utBridgeUrl: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${utBridgeUrl}/health`, PROBE_TIMEOUT_MS);
    return res.ok;
  } catch {
    return false;
  }
}

export async function probeHealthWithRetry(utBridgeUrl: string): Promise<void> {
  if (await probeHealth(utBridgeUrl)) return;
  await new Promise((r) => setTimeout(r, PROBE_RETRY_DELAY_MS));
  if (await probeHealth(utBridgeUrl)) return;
  throw new Error(`ut-bridge /health did not return 200 after T+0/T+2s probes (url=${utBridgeUrl})`);
}

// Returns null on 404, throws on network error or >=500.
export async function getHumanByDiscordId(discordId: string, utBridgeUrl: string): Promise<HumanIdentity | null> {
  let res: Response;
  try {
    res = await fetchWithTimeout(`${utBridgeUrl}/humans/by-discord/${encodeURIComponent(discordId)}`, PROBE_TIMEOUT_MS);
  } catch (e: any) {
    throw new Error(`ut-bridge unreachable while resolving discord id ${discordId}: ${e?.message ?? e}`, { cause: e });
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`ut-bridge /humans/by-discord returned ${res.status} for discord id ${discordId}`);
  }
  const body = (await res.json()) as {
    humanId: string;
    paperclipUserId: string | null;
    name: string;
    isActive: boolean;
  };
  return {
    humanId: body.humanId,
    paperclipUserId: body.paperclipUserId ?? null,
    name: body.name,
    isActive: body.isActive,
  };
}

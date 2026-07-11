// intent: unit tests for ut-bridge-client — probeHealth + getHumanByDiscordId.
//   Uses a minimal fetch mock via vi.stubGlobal so the module under test never
//   hits a real network. Covers: 200 ok, non-200, network throw, 404 → null,
//   >=500 throw, and the JSON shape mapping.
// confidence: high

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { probeHealth, probeHealthWithRetry, getHumanByDiscordId } from "../src/ut-bridge-client.js";

const BASE = "http://127.0.0.1:3201";

function mockFetch(responses: Array<{ status: number; body?: unknown; throws?: Error }>) {
  let idx = 0;
  return vi.fn(async (_url: string) => {
    const spec = responses[idx++] ?? responses[responses.length - 1];
    if (spec.throws) throw spec.throws;
    return {
      ok: spec.status >= 200 && spec.status < 300,
      status: spec.status,
      json: async () => spec.body,
    };
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("probeHealth", () => {
  it("returns true when /health returns 200", async () => {
    vi.stubGlobal("fetch", mockFetch([{ status: 200 }]));
    expect(await probeHealth(BASE)).toBe(true);
  });

  it("returns false when /health returns 503", async () => {
    vi.stubGlobal("fetch", mockFetch([{ status: 503 }]));
    expect(await probeHealth(BASE)).toBe(false);
  });

  it("returns false when fetch throws (network error)", async () => {
    vi.stubGlobal("fetch", mockFetch([{ status: 0, throws: new Error("ECONNREFUSED") }]));
    expect(await probeHealth(BASE)).toBe(false);
  });
});

describe("probeHealthWithRetry", () => {
  it("resolves when first probe succeeds", async () => {
    vi.stubGlobal("fetch", mockFetch([{ status: 200 }]));
    await expect(probeHealthWithRetry(BASE)).resolves.toBeUndefined();
  });

  it("resolves when only the second probe succeeds", async () => {
    vi.stubGlobal("fetch", mockFetch([{ status: 503 }, { status: 200 }]));
    const p = probeHealthWithRetry(BASE);
    // Attach handler BEFORE advancing timers to prevent unhandled-rejection noise.
    const check = expect(p).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(2100);
    await check;
  });

  it("throws when both probes fail", async () => {
    vi.stubGlobal("fetch", mockFetch([{ status: 503 }, { status: 503 }]));
    const p = probeHealthWithRetry(BASE);
    // Attach handler BEFORE advancing timers to prevent unhandled-rejection noise.
    const check = expect(p).rejects.toThrow("ut-bridge /health did not return 200");
    await vi.advanceTimersByTimeAsync(2100);
    await check;
  });
});

describe("getHumanByDiscordId", () => {
  it("returns the identity object on 200", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch([
        {
          status: 200,
          body: {
            humanId: "h-danny",
            paperclipUserId: "pc-user-1",
            name: "Danny",
            isActive: true,
          },
        },
      ])
    );
    const result = await getHumanByDiscordId("111122223333", BASE);
    expect(result).toEqual({
      humanId: "h-danny",
      paperclipUserId: "pc-user-1",
      name: "Danny",
      isActive: true,
    });
  });

  it("returns null on 404", async () => {
    vi.stubGlobal("fetch", mockFetch([{ status: 404 }]));
    expect(await getHumanByDiscordId("unknown", BASE)).toBeNull();
  });

  it("throws on 500", async () => {
    vi.stubGlobal("fetch", mockFetch([{ status: 500 }]));
    await expect(getHumanByDiscordId("any", BASE)).rejects.toThrow("500");
  });

  it("throws on network error", async () => {
    vi.stubGlobal("fetch", mockFetch([{ status: 0, throws: new Error("ECONNREFUSED") }]));
    await expect(getHumanByDiscordId("any", BASE)).rejects.toThrow("ut-bridge unreachable");
  });

  it("maps null paperclipUserId correctly", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch([{ status: 200, body: { humanId: "h-anon", paperclipUserId: null, name: "Anon", isActive: false } }])
    );
    const result = await getHumanByDiscordId("999", BASE);
    expect(result?.paperclipUserId).toBeNull();
  });
});

// intent: cache + reconnect-coalescing tests for the identity resolver.
//   Covers:
//   (a) positive-hit cache returns same object without re-fetching
//   (b) miss cache returns null for 30s without re-fetching
//   (c) coalescing — two concurrent resolveIdentity calls for the same discordId
//       share one in-flight promise (single ut-bridge round-trip)
//   (d) cache expiry re-fetches after TTL
// confidence: high

import { describe, it, expect, vi, beforeEach } from "vitest";

// Automock the dependency — vi.mock is hoisted so we cannot reference a `let`
// variable in the factory. Use the automock form and vi.mocked() instead.
vi.mock("../src/ut-bridge-client.js");

import { getHumanByDiscordId } from "../src/ut-bridge-client.js";
import { resolveIdentity, invalidateIdentityCache, __getInflightMapForTests } from "../src/identity.js";

const mockGetHuman = vi.mocked(getHumanByDiscordId);

const BASE = "http://127.0.0.1:3201";

const DANNY: import("../src/identity.js").HumanIdentity = {
  humanId: "h-danny",
  paperclipUserId: "pc-user-1",
  name: "Danny",
  isActive: true,
};

beforeEach(() => {
  mockGetHuman.mockReset();
  invalidateIdentityCache(); // clear cache between tests
});

describe("(a) positive-hit cache", () => {
  it("returns identity on first call and hits cache on second", async () => {
    mockGetHuman.mockResolvedValue(DANNY);
    const first = await resolveIdentity("111", BASE);
    expect(first).toEqual(DANNY);
    expect(mockGetHuman).toHaveBeenCalledTimes(1);

    const second = await resolveIdentity("111", BASE);
    expect(second).toEqual(DANNY);
    expect(mockGetHuman).toHaveBeenCalledTimes(1); // cache hit
  });
});

describe("(b) miss cache (404 → null stays null for TTL)", () => {
  it("returns null on 404 and does not re-fetch within miss TTL", async () => {
    mockGetHuman.mockResolvedValue(null);
    const first = await resolveIdentity("unmapped", BASE);
    expect(first).toBeNull();
    expect(mockGetHuman).toHaveBeenCalledTimes(1);

    const second = await resolveIdentity("unmapped", BASE);
    expect(second).toBeNull();
    expect(mockGetHuman).toHaveBeenCalledTimes(1); // miss cache hit
  });
});

describe("(c) reconnect coalescing", () => {
  it("two concurrent calls for the same discordId share one in-flight promise", async () => {
    let resolvePromise!: (v: typeof DANNY) => void;
    mockGetHuman.mockReturnValue(
      new Promise<typeof DANNY>((res) => {
        resolvePromise = res;
      })
    );

    const p1 = resolveIdentity("coalesce-user", BASE);
    const p2 = resolveIdentity("coalesce-user", BASE);

    // Only one fetch should be in-flight at this point
    expect(mockGetHuman).toHaveBeenCalledTimes(1);
    expect(__getInflightMapForTests().has("coalesce-user")).toBe(true);

    resolvePromise(DANNY);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual(DANNY);
    expect(r2).toEqual(DANNY);
    expect(mockGetHuman).toHaveBeenCalledTimes(1); // still just one call
    expect(__getInflightMapForTests().has("coalesce-user")).toBe(false); // cleared after settle
  });

  it("different discordIds each get their own fetch", async () => {
    mockGetHuman.mockResolvedValue(DANNY);
    await Promise.all([resolveIdentity("userA", BASE), resolveIdentity("userB", BASE)]);
    expect(mockGetHuman).toHaveBeenCalledTimes(2);
  });
});

describe("(d) invalidateIdentityCache forces re-fetch", () => {
  it("targeted invalidation clears one entry", async () => {
    mockGetHuman.mockResolvedValue(DANNY);
    await resolveIdentity("target-user", BASE);
    expect(mockGetHuman).toHaveBeenCalledTimes(1);

    invalidateIdentityCache("target-user");
    await resolveIdentity("target-user", BASE);
    expect(mockGetHuman).toHaveBeenCalledTimes(2);
  });
});

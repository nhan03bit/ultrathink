// intent: cache + cross-call-timeout + 404 unit tests for the /humans route
//   layer. Covers the rev-2 verification requirements:
//     - getHumans() caches within TTL, force=true busts
//     - getHuman(id) returns null for unknown id (drives the 404 path)
//     - raceWithBudget reports unavailable=true on timeout/error and false on success
// confidence: high

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock the Neon SQL helper before importing the cache module — humans.ts grabs
// getSql() lazily inside fetchHumans(), so the mock just needs to be in place
// by the time getHumans() runs.
vi.mock("./db.js", () => {
  return {
    getSql: () => mockSql,
  };
});

let sqlCallCount = 0;
let mockRows: Array<Record<string, unknown>> = [];

function mockSql(_strings: TemplateStringsArray, ..._values: unknown[]): Promise<unknown[]> {
  sqlCallCount += 1;
  return Promise.resolve(mockRows);
}

import { getHumans, getHuman, getHumanByDiscordId, __resetHumansCacheForTests } from "./humans.js";
import { raceWithBudget } from "./routes/humans.js";

beforeEach(() => {
  sqlCallCount = 0;
  mockRows = [
    {
      id: "h-danny",
      name: "Danny",
      email: "danny@example.com",
      github_username: "danny",
      timezone: "America/Los_Angeles",
      working_hours_start: "09:00",
      working_hours_end: "17:00",
      reports_to: null,
      is_active: true,
      paperclip_user_id: "pc-user-1",
      discord_user_id: "111122223333444455",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-04-01T00:00:00.000Z",
    },
  ];
  __resetHumansCacheForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getHumans cache", () => {
  it("loads from sql on first call and caches subsequent calls within TTL", async () => {
    const first = await getHumans();
    expect(first).toHaveLength(1);
    expect(first[0]?.id).toBe("h-danny");
    expect(sqlCallCount).toBe(1);

    const second = await getHumans();
    expect(second).toEqual(first);
    expect(sqlCallCount).toBe(1); // cache hit — no second SQL call
  });

  it("force=true busts the cache", async () => {
    await getHumans();
    expect(sqlCallCount).toBe(1);
    await getHumans(true);
    expect(sqlCallCount).toBe(2);
  });
});

describe("getHuman lookup", () => {
  it("returns the matching human", async () => {
    const found = await getHuman("h-danny");
    expect(found?.name).toBe("Danny");
  });

  it("returns null for an unknown id (drives the 404 response in the route)", async () => {
    const missing = await getHuman("00000000-0000-0000-0000-000000000000");
    expect(missing).toBeNull();
  });
});

describe("getHumanByDiscordId lookup (INU-41 / discord-bot identity resolver)", () => {
  it("returns the matching human by discord_user_id", async () => {
    const found = await getHumanByDiscordId("111122223333444455");
    expect(found?.id).toBe("h-danny");
    expect(found?.paperclip_user_id).toBe("pc-user-1");
  });

  it("returns null for an unmapped discord user (drives the 404 → bot's polite reply)", async () => {
    const missing = await getHumanByDiscordId("999999999999999999");
    expect(missing).toBeNull();
  });
});

describe("raceWithBudget (cross-call timeout)", () => {
  it("returns events and unavailable=false on success", async () => {
    const result = await raceWithBudget(Promise.resolve([{ a: 1 }, { a: 2 }]), 1000);
    expect(result.unavailable).toBe(false);
    expect(result.events).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("reports unavailable=true if the promise rejects", async () => {
    const result = await raceWithBudget(Promise.reject(new Error("boom")), 1000);
    expect(result.unavailable).toBe(true);
    expect(result.events).toEqual([]);
  });

  it("reports unavailable=true when the budget is exceeded", async () => {
    vi.useFakeTimers();
    const slow = new Promise<unknown[]>((resolve) => {
      setTimeout(() => resolve([{ ok: true }]), 10_000);
    });
    const racing = raceWithBudget(slow, 3000);
    await vi.advanceTimersByTimeAsync(3001);
    const result = await racing;
    expect(result.unavailable).toBe(true);
    expect(result.events).toEqual([]);
  });
});

// intent: doc rev 2 step 13 — token redaction. Three sub-cases:
//   (a) literal-string registry replaces exact env-derived secret values
//   (b) Discord-token-shape backstop catches runtime-arrived tokens
//   (c) false-positive corpus (UUIDs, SHAs, JWT segments) is NOT replaced
// confidence: high

import { describe, it, expect, beforeEach } from "vitest";
import {
  redact,
  registerSecret,
  registerSecretsFromEnv,
  resetSecretRegistryForTests,
  registeredCount,
} from "../src/secret-redact.js";

// Synthetic tokens used in tests — none of these are real credentials.
const SYNTHETIC_DISCORD_TOKEN = "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM.AbCdEf.GhIjKlMnOpQrStUvWxYzAbCdEfGhIjK";
const SYNTHETIC_API_KEY = "sk_live_abcdefghijklmnopqrstuvwx";

beforeEach(() => {
  resetSecretRegistryForTests();
});

describe("(a) literal-string redaction from registered secrets", () => {
  it("replaces a registered secret embedded in a longer log line", () => {
    registerSecret(SYNTHETIC_DISCORD_TOKEN);
    const out = redact(`auth failed for token=${SYNTHETIC_DISCORD_TOKEN} retrying...`);
    expect(out).not.toContain(SYNTHETIC_DISCORD_TOKEN);
    expect(out).toContain("[redacted]");
  });

  it("replaces every occurrence of the same literal", () => {
    registerSecret(SYNTHETIC_API_KEY);
    const out = redact(`${SYNTHETIC_API_KEY} ${SYNTHETIC_API_KEY} ${SYNTHETIC_API_KEY}`);
    expect(out).toBe("[redacted] [redacted] [redacted]");
  });

  it("redacts secrets pulled from env via registerSecretsFromEnv (only *_TOKEN/*_KEY/DISCORD_BOT_TOKEN)", () => {
    const fakeEnv = {
      DISCORD_BOT_TOKEN: SYNTHETIC_DISCORD_TOKEN,
      PAPERCLIP_API_KEY: SYNTHETIC_API_KEY,
      DATABASE_URL: "postgres://user:pass@host/db", // not a *_TOKEN/*_KEY → NOT registered
      DISCORD_APP_ID: "1234567890", // not secret-shaped name → NOT registered
    } as unknown as NodeJS.ProcessEnv;
    registerSecretsFromEnv(fakeEnv);
    expect(registeredCount()).toBe(2);
    const log = `tok=${SYNTHETIC_DISCORD_TOKEN} key=${SYNTHETIC_API_KEY} db=${fakeEnv.DATABASE_URL}`;
    const out = redact(log);
    expect(out).not.toContain(SYNTHETIC_DISCORD_TOKEN);
    expect(out).not.toContain(SYNTHETIC_API_KEY);
    // DATABASE_URL was NOT registered so it stays put — caller must register it
    // explicitly if they want it scrubbed.
    expect(out).toContain("postgres://user:pass@host/db");
  });

  it("redacts secret embedded in an Error stack passed to redact()", () => {
    registerSecret(SYNTHETIC_DISCORD_TOKEN);
    const err = new Error(`Authorization=${SYNTHETIC_DISCORD_TOKEN} rejected`);
    const out = redact(err);
    expect(out).not.toContain(SYNTHETIC_DISCORD_TOKEN);
    expect(out).toContain("[redacted]");
  });
});

describe("(b) Discord-token-shape backstop regex catches unregistered tokens", () => {
  it("redacts a Discord-shaped token even with NO secret registered", () => {
    const out = redact(`incoming webhook with bearer ${SYNTHETIC_DISCORD_TOKEN}`);
    expect(out).not.toContain(SYNTHETIC_DISCORD_TOKEN);
    expect(out).toContain("[redacted]");
  });

  it("does NOT depend on secret registry — registry is empty in this test", () => {
    expect(registeredCount()).toBe(0);
    const out = redact(SYNTHETIC_DISCORD_TOKEN);
    expect(out).toBe("[redacted]");
  });
});

describe("(c) false-positive corpus must NOT be redacted", () => {
  // The OLD `^[A-Za-z0-9_-]{24,}$` pattern would have falsely matched UUIDs
  // and SHAs. The new `\b[\w-]{20,}\.[\w-]{6}\.[\w-]{27,}\b` pattern requires
  // the dot structure, so these all stay intact.
  it("UUID v4 is preserved", () => {
    const uuid = "3d53949c-bee6-47b0-9411-6f94c4957691";
    expect(redact(uuid)).toBe(uuid);
  });

  it("git commit SHA is preserved", () => {
    expect(redact("commit 7f127d9e8a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d")).toBe(
      "commit 7f127d9e8a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d"
    );
  });

  it("JWT (3-part) is preserved — middle segment is far longer than 6 chars", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    expect(redact(jwt)).toBe(jwt);
  });

  it("a URL with dots is preserved (no contiguous {20+}.{6}.{27+} run)", () => {
    const url = "http://discord.com/api/v10/channels/1234567890/messages";
    expect(redact(url)).toBe(url);
  });

  it("npm package versions are preserved", () => {
    expect(redact("discord.js@14.16.3 zod@3.23.8")).toBe("discord.js@14.16.3 zod@3.23.8");
  });
});

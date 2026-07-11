// intent: hash-idempotency tests for registerCommandsIfChanged.
//   Covers:
//   (a) no hash file → calls restPut and writes new hash
//   (b) hash matches stored hash → skips restPut
//   (c) hash changes → calls restPut and updates hash file
//   (d) restPut failure → error propagates (caller decides whether fatal)
// confidence: high

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

import { readFileSync, writeFileSync } from "node:fs";
import { registerCommandsIfChanged, type SlashCommandDef } from "../src/register-commands.js";

const COMMANDS: SlashCommandDef[] = [
  { name: "issue", description: "Issue operations" },
  { name: "wake", description: "Wake an agent" },
];

beforeEach(() => {
  vi.mocked(readFileSync).mockReset();
  vi.mocked(writeFileSync).mockReset();
});

describe("(a) no hash file — registers and writes hash", () => {
  it("calls restPut and writes the computed hash when no file exists", async () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });
    const restPut = vi.fn().mockResolvedValue(undefined);
    const result = await registerCommandsIfChanged(restPut, COMMANDS);
    expect(result).toBe(true);
    expect(restPut).toHaveBeenCalledWith(COMMANDS);
    expect(writeFileSync).toHaveBeenCalledTimes(1);
    // Written content should be a 64-char hex SHA-256 + newline
    const written = vi.mocked(writeFileSync).mock.calls[0]![1] as string;
    expect(written).toMatch(/^[0-9a-f]{64}\n$/);
  });
});

describe("(b) hash matches — skips restPut", () => {
  it("does not call restPut when hash is current", async () => {
    // Compute expected hash by running the same logic
    const { createHash } = await import("node:crypto");
    const expectedHash = createHash("sha256").update(JSON.stringify(COMMANDS)).digest("hex");
    vi.mocked(readFileSync).mockReturnValue(expectedHash + "\n");

    const restPut = vi.fn();
    const result = await registerCommandsIfChanged(restPut, COMMANDS);
    expect(result).toBe(false);
    expect(restPut).not.toHaveBeenCalled();
    expect(writeFileSync).not.toHaveBeenCalled();
  });
});

describe("(c) hash changed — re-registers and updates hash", () => {
  it("calls restPut and overwrites hash file on hash mismatch", async () => {
    vi.mocked(readFileSync).mockReturnValue("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n");
    const restPut = vi.fn().mockResolvedValue(undefined);
    const result = await registerCommandsIfChanged(restPut, COMMANDS);
    expect(result).toBe(true);
    expect(restPut).toHaveBeenCalledWith(COMMANDS);
    expect(writeFileSync).toHaveBeenCalledTimes(1);
  });
});

describe("(d) restPut failure propagates", () => {
  it("throws when restPut rejects (caller decides register-fail policy)", async () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });
    const restPut = vi.fn().mockRejectedValue(new Error("discord REST 429"));
    await expect(registerCommandsIfChanged(restPut, COMMANDS)).rejects.toThrow("discord REST 429");
    // Hash file must NOT be written if the PUT failed
    expect(writeFileSync).not.toHaveBeenCalled();
  });
});

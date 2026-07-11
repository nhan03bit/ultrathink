// intent: doc rev 2 step 3 — boot order assertion that does NOT require a
//   compiled dist/. Two layers:
//
//     (a) static check — read src/index.ts and assert that the line
//         containing the DISCORD_BOT_ENABLED flag check appears BEFORE any
//         line containing `new Client(` or `import("discord.js")`. The OLD
//         brittle grep-only check is upgraded into a real unit assertion so
//         a regression here fails the test suite, not just CI.
//
//     (b) runtime check — call main() with DISCORD_BOT_ENABLED unset and
//         assert it returns 0 cleanly without ever attempting to load
//         discord.js. We assert this by checking process exit code via the
//         function return value AND by scanning the registered module cache
//         after the run.
// confidence: high

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const INDEX_SRC = resolve(__dirname, "../src/index.ts");

describe("(a) static boot-order: flag check precedes any discord.js construction", () => {
  const src = readFileSync(INDEX_SRC, "utf8");
  const lines = src.split("\n");

  // Doc rev 2 step 3 intent: the actual constructor invocation must appear
  // after the flag check. Pure-comment lines (`//` at line-start) document
  // intent for readers and do not execute, so they are excluded from the
  // ordering check.
  function isCodeLine(l: string): boolean {
    return !/^\s*\/\//.test(l);
  }

  function findLine(predicate: (l: string) => boolean): number {
    return lines.findIndex(predicate);
  }

  it("flag check exists in src/index.ts", () => {
    const idx = findLine(
      (l) => /DISCORD_BOT_ENABLED/.test(l) && /(parseFlagEnv|flag\.DISCORD_BOT_ENABLED|!flag)/.test(l)
    );
    expect(idx).toBeGreaterThanOrEqual(0);
  });

  it("any executable `new Client(` appears AFTER the flag check", () => {
    const flagIdx = findLine((l) => /flag\.DISCORD_BOT_ENABLED/.test(l));
    expect(flagIdx).toBeGreaterThanOrEqual(0);
    const newClientIdx = lines.findIndex((l) => /new Client\(/.test(l) && isCodeLine(l));
    if (newClientIdx === -1) return; // none yet — vacuously satisfied
    expect(newClientIdx).toBeGreaterThan(flagIdx);
  });

  it('any executable `import("discord.js")` appears AFTER the flag check', () => {
    const flagIdx = findLine((l) => /flag\.DISCORD_BOT_ENABLED/.test(l));
    expect(flagIdx).toBeGreaterThanOrEqual(0);
    const importIdx = lines.findIndex((l) => /import\(\s*["']discord\.js["']/.test(l) && isCodeLine(l));
    if (importIdx === -1) return;
    expect(importIdx).toBeGreaterThan(flagIdx);
  });

  it('there is no top-level `import ... from "discord.js"` (must be dynamic)', () => {
    const topLevelStaticImport = lines.find((l) => /^\s*import\s.+from\s+["']discord\.js["']/.test(l));
    expect(topLevelStaticImport).toBeUndefined();
  });
});

describe("(b) runtime boot-order: disabled-mode never loads discord.js", () => {
  it("main() with the flag unset returns 0 and does not load discord.js", async () => {
    const before = Object.keys(require.cache ?? {}).filter((k) => k.includes("discord.js")).length;
    const { main } = await import("../src/index.js");
    const code = await main({ DISCORD_BOT_ENABLED: "false" } as NodeJS.ProcessEnv);
    expect(code).toBe(0);
    const after = Object.keys(require.cache ?? {}).filter((k) => k.includes("discord.js")).length;
    // Both before and after should be 0 — discord.js is never imported in
    // disabled mode. We assert the delta is zero so the check works whether
    // or not vitest pre-loaded anything for unrelated reasons.
    expect(after).toBe(before);
  });

  it("main() with no env at all (default flag=false) also exits 0", async () => {
    const { main } = await import("../src/index.js");
    const code = await main({} as NodeJS.ProcessEnv);
    expect(code).toBe(0);
  });
});

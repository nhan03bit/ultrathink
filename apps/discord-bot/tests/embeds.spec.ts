// intent: doc rev 2 step 15 — embed factory contract:
//   (a) factory rejects construction without actorName/nextStep (type + runtime)
//   (b) emoji-stripped readability
//   (c) <t:UNIX:R> Discord timestamp tag
//   (d) non-empty content fallback
// confidence: high

import { describe, it, expect } from "vitest";
import { buildEmbed, stripEmoji } from "../src/embeds.js";

describe("(a) factory requires actorName + nextStep", () => {
  it("throws when actorName is missing", () => {
    // @ts-expect-error — actorName intentionally omitted to assert the type contract
    expect(() => buildEmbed({ nextStep: "review", title: "Doc sealed" })).toThrow();
  });

  it("throws when nextStep is missing", () => {
    // @ts-expect-error — nextStep intentionally omitted to assert the type contract
    expect(() => buildEmbed({ actorName: "Steven", title: "Doc sealed" })).toThrow();
  });

  it("throws when actorName is empty", () => {
    expect(() => buildEmbed({ actorName: "", nextStep: "review", title: "Doc sealed" })).toThrow();
  });

  it("throws when nextStep is empty", () => {
    expect(() => buildEmbed({ actorName: "Steven", nextStep: "", title: "Doc sealed" })).toThrow();
  });

  it("succeeds when all required fields are present", () => {
    const built = buildEmbed({
      actorName: "Steven",
      nextStep: "code-lane review",
      title: "Doc INU-24 rev 2 sealed",
    });
    expect(built.embed.title).toBe("Doc INU-24 rev 2 sealed");
    expect(built.embed.footer.text).toContain("Steven");
    expect(built.embed.footer.text).toContain("code-lane review");
  });
});

describe("(b) emoji-stripped readability", () => {
  it("stripEmoji removes pictographs but keeps text", () => {
    expect(stripEmoji("✅ Approved by Mira")).toBe("Approved by Mira");
    expect(stripEmoji("🚫 Cancelled — runId=abc")).toBe("Cancelled — runId=abc");
    expect(stripEmoji("🎉🎊 ship it 🚀")).toBe("ship it");
  });

  it("content fallback strips emoji from title + description", () => {
    const built = buildEmbed({
      actorName: "Quinn",
      nextStep: "approve or block",
      title: "✅ Doc rev 2 ready",
      description: "🎉 lanes returned approve",
    });
    expect(built.content).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(built.content).toContain("Doc rev 2 ready");
    expect(built.content).toContain("lanes returned approve");
    expect(built.content).toContain("Quinn");
    expect(built.content).toContain("approve or block");
  });
});

describe("(c) Discord timestamp tag <t:UNIX:R>", () => {
  it("emits <t:UNIX:R> in content when timestampUnix is provided", () => {
    const ts = 1745870026; // arbitrary UNIX seconds
    const built = buildEmbed({
      actorName: "Casey",
      nextStep: "scaffold next slice",
      title: "Build readiness updated",
      timestampUnix: ts,
    });
    expect(built.timestampTag).toBe(`<t:${ts}:R>`);
    expect(built.content).toContain(`<t:${ts}:R>`);
    expect(built.embed.timestamp).toBe(new Date(ts * 1000).toISOString());
  });

  it("omits the tag when no timestamp is provided", () => {
    const built = buildEmbed({
      actorName: "Casey",
      nextStep: "scaffold next slice",
      title: "Build readiness updated",
    });
    expect(built.timestampTag).toBeNull();
    expect(built.embed.timestamp).toBeUndefined();
    expect(built.content).not.toMatch(/<t:\d+:R>/);
  });
});

describe("(d) non-empty content fallback", () => {
  it("content is always non-empty even when description is omitted", () => {
    const built = buildEmbed({
      actorName: "Alex",
      nextStep: "apply rollback on Neon branch",
      title: "Migration 026 applied",
    });
    expect(built.content.length).toBeGreaterThan(0);
    expect(built.content).toContain("Alex");
    expect(built.content).toContain("apply rollback on Neon branch");
  });

  it("content respects Discord's 2000-char content limit", () => {
    const built = buildEmbed({
      actorName: "X",
      nextStep: "Y",
      title: "T".repeat(3000),
    });
    expect(built.content.length).toBeLessThanOrEqual(2000);
  });
});

describe("footer custom-id encoding (used by reaction handler to resolve target)", () => {
  it("appends footerCustomId to the footer text when present", () => {
    const built = buildEmbed({
      actorName: "Quinn",
      nextStep: "vote on lane",
      title: "Doc-review request",
      footerCustomId: "doc=3d53949c|rev=4bd98810|num=2|issue=50ce718c",
    });
    expect(built.embed.footer.text).toContain("doc=3d53949c|rev=4bd98810|num=2|issue=50ce718c");
  });
});

import { describe, it, expect } from "vitest";
import { buildEmbed, COLORS } from "../src/embed-builder.js";
import { routeEvent } from "../src/event-router.js";

describe("buildEmbed", () => {
  it("renders an issue.created embed with bracketed agent name", () => {
    const embed = buildEmbed({
      name: "issue.created",
      occurredAt: "2026-04-26T10:00:00.000Z",
      payload: {
        identifier: "PAP-42",
        title: "Wire up the cookie jar",
        priority: "high",
        assigneeName: "Mira [Code Integrator]",
      },
      actor: { type: "agent", name: "Steven", title: "CEO" },
    });
    expect(embed).not.toBeNull();
    expect(embed!.title).toContain("PAP-42");
    expect(embed!.color).toBe(COLORS.gray);
    expect(embed!.author?.name).toBe("Steven [CEO]");
    const fieldNames = (embed!.fields ?? []).map((f) => f.name);
    expect(fieldNames).toEqual(["Priority", "Assignee"]);
  });

  it("renders document.reviewed with red color when blocked", () => {
    const embed = buildEmbed({
      name: "document.reviewed",
      payload: { decision: "block", title: "Auth design", comment: "Missing threat model" },
      actor: { name: "Daniel" },
    });
    expect(embed!.color).toBe(COLORS.red);
    expect(embed!.author?.name).toBe("Daniel");
  });

  it("colors agent.error red and includes the alert mention", () => {
    const embed = buildEmbed(
      {
        name: "agent.error",
        payload: { error: "Adapter timed out" },
        actor: { type: "agent", name: "Mira", title: "Code Integrator" },
      },
      { alertMention: "<@123>" }
    );
    expect(embed!.color).toBe(COLORS.red);
    expect(embed!.description).toContain("<@123>");
  });
});

describe("routeEvent", () => {
  it("fans agent-actor issue.created to #feed and #agents", () => {
    const decision = routeEvent(
      {
        name: "issue.created",
        actor: { type: "agent", name: "Steven", title: "CEO" },
      },
      { minRunCostUsd: 0.5, directorMention: "" }
    );
    expect(decision.channels.sort()).toEqual(["agents", "feed"]);
  });

  it("fans human-actor issue.completed to #feed and #humans", () => {
    const decision = routeEvent(
      { name: "issue.completed", actor: { type: "human", name: "Daniel" } },
      { minRunCostUsd: 0.5, directorMention: "" }
    );
    expect(decision.channels.sort()).toEqual(["feed", "humans"]);
  });

  it("suppresses cheap agent.run.finished and routes expensive ones to #feed", () => {
    const cheap = routeEvent(
      { name: "agent.run.finished", payload: { costUsd: 0.05 }, actor: { name: "Mira", title: "Code Integrator" } },
      { minRunCostUsd: 0.5, directorMention: "" }
    );
    expect(cheap.suppress).toBe(true);

    const pricey = routeEvent(
      { name: "agent.run.finished", payload: { costUsd: 1.5 }, actor: { name: "Mira", title: "Code Integrator" } },
      { minRunCostUsd: 0.5, directorMention: "" }
    );
    expect(pricey.channels).toContain("feed");
    expect(pricey.channels).toContain("agents");
    expect(pricey.suppress).toBeFalsy();
  });

  it("routes issue.blocked to #alerts with director mention", () => {
    const decision = routeEvent(
      {
        name: "issue.blocked",
        actor: { type: "agent", name: "Mira", title: "Code Integrator" },
      },
      { minRunCostUsd: 0.5, directorMention: "999" }
    );
    expect(decision.channels).toContain("alerts");
    expect(decision.alertMention).toBe("<@999>");
  });

  it("adds #human→agent when triggerType is human_mention", () => {
    const decision = routeEvent(
      {
        name: "issue.comment.created",
        actor: { type: "human", name: "Daniel" },
        triggerType: "human_mention",
      },
      { minRunCostUsd: 0.5, directorMention: "" }
    );
    expect(decision.channels).toContain("humanAgent");
    expect(decision.channels).toContain("humans");
  });
});

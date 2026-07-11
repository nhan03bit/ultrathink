import { describe, it, expect } from "vitest";
import { mapActivityRowToEnvelope, resolveSyntheticName, type ActivityRowLike } from "../src/activity-mapper.js";

describe("resolveSyntheticName", () => {
  it("matches dotted action names directly", () => {
    expect(resolveSyntheticName({ action: "issue.completed", entityType: "issue" })).toBe("issue.completed");
    expect(resolveSyntheticName({ action: "issue.blocked", entityType: "issue" })).toBe("issue.blocked");
    expect(resolveSyntheticName({ action: "document.created", entityType: "document" })).toBe("document.created");
    expect(resolveSyntheticName({ action: "document.reviewed", entityType: "document" })).toBe("document.reviewed");
    expect(resolveSyntheticName({ action: "document.approved", entityType: "document" })).toBe("document.approved");
    expect(resolveSyntheticName({ action: "agent.error", entityType: "agent" })).toBe("agent.error");
    expect(resolveSyntheticName({ action: "budget.threshold", entityType: "budget" })).toBe("budget.threshold");
    expect(resolveSyntheticName({ action: "heartbeat_run.completed", entityType: "heartbeat_run" })).toBe(
      "heartbeat_run.completed"
    );
  });

  it("falls back to bare verbs when entityType disambiguates", () => {
    expect(resolveSyntheticName({ action: "completed", entityType: "issue" })).toBe("issue.completed");
    expect(resolveSyntheticName({ action: "blocked", entityType: "issue" })).toBe("issue.blocked");
    expect(resolveSyntheticName({ action: "approved", entityType: "document" })).toBe("document.approved");
    expect(resolveSyntheticName({ action: "errored", entityType: "agent" })).toBe("agent.error");
    expect(resolveSyntheticName({ action: "threshold_breached", entityType: "budget" })).toBe("budget.threshold");
  });

  it("returns null when the row is not synthetic-relevant", () => {
    expect(resolveSyntheticName({ action: "issue.created", entityType: "issue" })).toBeNull();
    expect(resolveSyntheticName({ action: "viewed", entityType: "document" })).toBeNull();
    expect(resolveSyntheticName({ action: "", entityType: "issue" })).toBeNull();
    expect(resolveSyntheticName({ action: "completed" })).toBeNull(); // no entityType
  });
});

describe("mapActivityRowToEnvelope", () => {
  it("constructs an envelope ready for dispatchEvent", () => {
    const row: ActivityRowLike = {
      id: "evt-123",
      companyId: "co-1",
      actorType: "agent",
      actorId: "ag-1",
      action: "issue.completed",
      entityType: "issue",
      entityId: "iss-9",
      agentId: "ag-1",
      runId: null,
      details: {
        title: "Wire up the cookie jar",
        identifier: "PAP-42",
        actorName: "Steven",
        agentTitle: "CEO",
      },
      createdAt: "2026-04-26T12:00:00.000Z",
    };
    const env = mapActivityRowToEnvelope(row, { hostUrl: "https://paperclip.local" });
    expect(env).not.toBeNull();
    expect(env!.name).toBe("issue.completed");
    expect(env!.id).toBe("evt-123");
    expect(env!.entityId).toBe("iss-9");
    expect(env!.companyId).toBe("co-1");
    expect(env!.actor).toEqual({ type: "agent", name: "Steven", title: "CEO" });
    expect(env!.payload?.title).toBe("Wire up the cookie jar");
    expect(env!.occurredAt).toBe("2026-04-26T12:00:00.000Z");
    expect(env!.hostUrl).toBe("https://paperclip.local");
  });

  it("normalizes user → human in actor.type", () => {
    const env = mapActivityRowToEnvelope({
      action: "document.approved",
      entityType: "document",
      actorType: "user",
      details: { actorName: "Daniel", title: "Auth design" },
    });
    expect(env).not.toBeNull();
    expect(env!.actor?.type).toBe("human");
    expect(env!.actor?.name).toBe("Daniel");
  });

  it("returns null when no synthetic mapping applies", () => {
    expect(
      mapActivityRowToEnvelope({
        action: "viewed",
        entityType: "document",
      })
    ).toBeNull();
  });

  it("handles bare-verb rows with details fallback", () => {
    const env = mapActivityRowToEnvelope({
      action: "blocked",
      entityType: "issue",
      entityId: "iss-7",
      details: {
        identifier: "PAP-7",
        title: "Risky migration",
        reason: "Schema not approved",
      },
      actorType: "agent",
    });
    expect(env).not.toBeNull();
    expect(env!.name).toBe("issue.blocked");
    expect(env!.payload?.reason).toBe("Schema not approved");
  });

  it("accepts Date timestamps for createdAt", () => {
    const when = new Date("2026-04-26T12:34:56.000Z");
    const env = mapActivityRowToEnvelope({
      action: "agent.error",
      entityType: "agent",
      createdAt: when,
      details: { error: "Adapter timed out" },
    });
    expect(env!.occurredAt).toBe("2026-04-26T12:34:56.000Z");
  });
});

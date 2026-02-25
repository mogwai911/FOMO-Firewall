import { describe, expect, it } from "vitest";
import { calcPointDelta } from "@/lib/services/points";

describe("calcPointDelta", () => {
  it("dedupes calm point by item and day", () => {
    const store = new Set<string>();

    const first = calcPointDelta({
      eventType: "SCHEDULED",
      itemId: "item-1",
      dateKey: "2026-02-15",
      isHighNoise: true,
      createdKnowledgeCard: false,
      dedupeStore: store
    });
    const second = calcPointDelta({
      eventType: "SCHEDULED",
      itemId: "item-1",
      dateKey: "2026-02-15",
      isHighNoise: true,
      createdKnowledgeCard: false,
      dedupeStore: store
    });

    expect(first).toBe(1);
    expect(second).toBe(0);
  });

  it("shares calm dedupe across SCHEDULED and IGNORED in same day", () => {
    const store = new Set<string>();

    const first = calcPointDelta({
      eventType: "SCHEDULED",
      itemId: "item-2",
      dateKey: "2026-02-15",
      isHighNoise: true,
      createdKnowledgeCard: false,
      dedupeStore: store
    });
    const second = calcPointDelta({
      eventType: "IGNORED",
      itemId: "item-2",
      dateKey: "2026-02-15",
      isHighNoise: true,
      createdKnowledgeCard: false,
      dedupeStore: store
    });

    expect(first).toBe(1);
    expect(second).toBe(0);
  });

  it("dedupes growth point by item and day", () => {
    const store = new Set<string>();

    const first = calcPointDelta({
      eventType: "COMPLETED",
      itemId: "item-3",
      dateKey: "2026-02-15",
      isHighNoise: false,
      createdKnowledgeCard: true,
      dedupeStore: store
    });
    const second = calcPointDelta({
      eventType: "COMPLETED",
      itemId: "item-3",
      dateKey: "2026-02-15",
      isHighNoise: false,
      createdKnowledgeCard: true,
      dedupeStore: store
    });

    expect(first).toBe(2);
    expect(second).toBe(0);
  });

  it("returns 0 for completed without knowledge card", () => {
    const store = new Set<string>();
    const delta = calcPointDelta({
      eventType: "COMPLETED",
      itemId: "item-4",
      dateKey: "2026-02-15",
      isHighNoise: false,
      createdKnowledgeCard: false,
      dedupeStore: store
    });
    expect(delta).toBe(0);
  });
});

import { describe, expect, it, vi } from "vitest";
import { downgradeStaleKnowledgeCards } from "@/lib/services/knowledge-downgrade";

describe("knowledge-downgrade", () => {
  it("downgrades stale knowledge cards without revisit/reference activity", async () => {
    const listStaleKnowledgeCards = vi.fn().mockResolvedValue([
      {
        id: "k1",
        itemId: "item-1",
        triageId: "triage-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        contentJson: { title: "card" },
        item: { title: "Item title", url: "https://example.com/1" }
      }
    ]);

    const hasRecentActivity = vi.fn().mockResolvedValue(false);
    const createIndexCardFromKnowledge = vi.fn().mockResolvedValue(undefined);
    const deleteKnowledgeCard = vi.fn().mockResolvedValue(undefined);

    const result = await downgradeStaleKnowledgeCards({
      listStaleKnowledgeCards,
      hasRecentActivity,
      createIndexCardFromKnowledge,
      deleteKnowledgeCard
    });

    expect(result.scanned).toBe(1);
    expect(result.downgraded).toBe(1);
    expect(result.skipped).toBe(0);
    expect(createIndexCardFromKnowledge).toHaveBeenCalledTimes(1);
    expect(deleteKnowledgeCard).toHaveBeenCalledWith("k1");
  });

  it("skips card when recent activity exists", async () => {
    const listStaleKnowledgeCards = vi.fn().mockResolvedValue([
      {
        id: "k2",
        itemId: "item-2",
        triageId: "triage-2",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        contentJson: { title: "card2" },
        item: { title: "Item title2", url: "https://example.com/2" }
      }
    ]);

    const hasRecentActivity = vi.fn().mockResolvedValue(true);
    const createIndexCardFromKnowledge = vi.fn().mockResolvedValue(undefined);
    const deleteKnowledgeCard = vi.fn().mockResolvedValue(undefined);

    const result = await downgradeStaleKnowledgeCards({
      listStaleKnowledgeCards,
      hasRecentActivity,
      createIndexCardFromKnowledge,
      deleteKnowledgeCard
    });

    expect(result.scanned).toBe(1);
    expect(result.downgraded).toBe(0);
    expect(result.skipped).toBe(1);
    expect(createIndexCardFromKnowledge).not.toHaveBeenCalled();
    expect(deleteKnowledgeCard).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { queryLibrary } from "@/lib/services/library-query";

describe("queryLibrary ranking", () => {
  it("boosts MARK_RELEVANT and demotes MARK_NOT_RELEVANT deterministically", async () => {
    const db = {
      knowledgeCard: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "k-older-relevant",
            itemId: "item-relevant",
            createdAt: new Date("2026-02-01T00:00:00.000Z"),
            item: { title: "Relevant", url: "https://example.com/relevant" },
            triage: {}
          },
          {
            id: "k-newer-demoted",
            itemId: "item-demoted",
            createdAt: new Date("2026-02-03T00:00:00.000Z"),
            item: { title: "Demoted", url: "https://example.com/demoted" },
            triage: {}
          },
          {
            id: "k-middle-neutral",
            itemId: "item-neutral",
            createdAt: new Date("2026-02-02T00:00:00.000Z"),
            item: { title: "Neutral", url: "https://example.com/neutral" },
            triage: {}
          }
        ])
      },
      indexCard: {
        findMany: vi.fn().mockResolvedValue([])
      },
      eventLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            itemId: "item-relevant",
            eventType: "MARK_RELEVANT",
            createdAt: new Date("2026-02-10T00:00:00.000Z")
          },
          {
            itemId: "item-demoted",
            eventType: "MARK_NOT_RELEVANT",
            createdAt: new Date("2026-02-10T00:00:00.000Z")
          }
        ])
      }
    };

    const out = await queryLibrary(
      {
        type: "knowledge"
      },
      {
        db: db as any
      }
    );

    const ids = (out.knowledgeCards as Array<{ id: string }>).map((card) => card.id);
    expect(ids).toEqual(["k-older-relevant", "k-middle-neutral", "k-newer-demoted"]);
  });
});

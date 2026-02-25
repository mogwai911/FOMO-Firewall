import { describe, expect, it, vi } from "vitest";
import { queryReview } from "@/lib/services/review-query";

describe("queryReview", () => {
  it("marks item as deferredButImportant when correction event exists", async () => {
    const db = {
      eventLog: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              itemId: "item-1",
              createdAt: new Date("2026-02-01T00:00:00.000Z")
            }
          ])
          .mockResolvedValueOnce([
            {
              itemId: "item-1",
              eventType: "DEFERRED_BUT_IMPORTANT",
              createdAt: new Date("2026-02-10T00:00:00.000Z")
            }
          ])
      },
      item: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "item-1",
            title: "Item",
            url: "https://example.com",
            status: "SCHEDULED"
          }
        ])
      }
    };

    const out = await queryReview(
      {
        db: db as any,
        now: new Date("2026-02-12T00:00:00.000Z")
      }
    );

    expect(out).toHaveLength(1);
    expect(out[0].itemId).toBe("item-1");
    expect(out[0].deferredButImportant).toBe(true);
  });
});

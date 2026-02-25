import { describe, expect, it, vi } from "vitest";
import { getWeeklyKnowledgeBudgetStatus, resolveWeeklyWindowUtc } from "@/lib/services/knowledge-budget";

describe("knowledge-budget", () => {
  it("resolves monday-based UTC week window", () => {
    const now = new Date("2026-02-18T10:00:00.000Z"); // Wednesday
    const window = resolveWeeklyWindowUtc(now);

    expect(window.start.toISOString()).toBe("2026-02-16T00:00:00.000Z");
    expect(window.endExclusive.toISOString()).toBe("2026-02-23T00:00:00.000Z");
  });

  it("returns usage and exceeded state", async () => {
    const count = vi.fn().mockResolvedValue(10);
    const status = await getWeeklyKnowledgeBudgetStatus(
      {
        countCardsInWindow: count
      },
      {
        now: new Date("2026-02-18T10:00:00.000Z"),
        weeklyLimit: 10
      }
    );

    expect(status.used).toBe(10);
    expect(status.remaining).toBe(0);
    expect(status.exceeded).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";
import { createAppStorage } from "@/lib/storage/app-storage";

describe("app-storage", () => {
  it("reads signal for triage with source name", async () => {
    const signal = {
      id: "sig-1",
      title: "OpenAI update",
      summary: "breaking change",
      source: { name: "OpenAI Blog" }
    };
    const prisma = {
      signal: {
        findUnique: vi.fn().mockResolvedValue(signal)
      },
      memoryCard: { create: vi.fn() }
    };

    const storage = createAppStorage(prisma as any);
    const out = await storage.findSignalForTriage("sig-1");

    expect(prisma.signal.findUnique).toHaveBeenCalledWith({
      where: { id: "sig-1" },
      select: {
        id: true,
        title: true,
        summary: true,
        source: { select: { name: true } }
      }
    });
    expect(out).toEqual(signal);
  });

  it("saves insight cards and returns ids", async () => {
    const prisma = {
      signal: { findUnique: vi.fn() },
      insightCard: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: "card-1" })
          .mockResolvedValueOnce({ id: "card-2" })
      }
    };

    const storage = createAppStorage(prisma as any);
    const ids = await storage.saveInsightCards({
      sessionId: "session-1",
      signalId: "sig-1",
      cards: [
        {
          version: 1,
          signal_title: "Signal 1",
          value_summary: "Summary 1",
          core_insights: ["I1", "I2"],
          key_evidence: [{ text: "E1", from: "rss_summary" }],
          decision: "DO",
          next_action: "Action 1",
          risk_boundary: ["Risk 1"]
        },
        {
          version: 1,
          signal_title: "Signal 2",
          value_summary: "Summary 2",
          core_insights: ["I3", "I4"],
          key_evidence: [{ text: "E2", from: "conversation" }],
          decision: "FYI",
          next_action: "Action 2",
          risk_boundary: ["Risk 2"]
        }
      ]
    });

    expect(ids).toEqual(["card-1", "card-2"]);
    expect(prisma.insightCard.create).toHaveBeenCalledTimes(2);
  });
});

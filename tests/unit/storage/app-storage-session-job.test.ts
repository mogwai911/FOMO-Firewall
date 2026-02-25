import { describe, expect, it, vi } from "vitest";
import { createAppStorage } from "@/lib/storage/app-storage";

describe("app-storage session/job methods", () => {
  it("finds latest resumable session by signal", async () => {
    const session = {
      id: "session-1",
      signalId: "sig-1",
      status: "PAUSED",
      createdAt: new Date("2026-02-20T00:00:00.000Z"),
      updatedAt: new Date("2026-02-20T01:00:00.000Z")
    };

    const prisma = {
      signal: { findUnique: vi.fn() },
      signalTriage: { create: vi.fn() },
      job: { findUnique: vi.fn(), update: vi.fn() },
      insightCard: { create: vi.fn() },
      evidencePack: { create: vi.fn() },
      session: {
        findFirst: vi.fn().mockResolvedValue(session)
      }
    };

    const storage = createAppStorage(prisma as any);
    const out = await storage.findLatestResumableSessionBySignal("sig-1");

    expect(prisma.session.findFirst).toHaveBeenCalledWith({
      where: {
        signalId: "sig-1",
        status: {
          in: ["ACTIVE", "PAUSED"]
        }
      },
      orderBy: {
        updatedAt: "desc"
      },
      select: {
        id: true,
        signalId: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });
    expect(out).toEqual(session);
  });

  it("lists insight cards with filters and descending order", async () => {
    const rows = [
      {
        id: "card-1",
        sessionId: "session-1",
        signalId: "sig-1",
        insightJson: { value_summary: "Q" },
        createdAt: new Date("2026-02-20T01:00:00.000Z")
      }
    ];

    const prisma = {
      signal: { findUnique: vi.fn() },
      signalTriage: { create: vi.fn() },
      job: { findUnique: vi.fn(), update: vi.fn() },
      insightCard: {
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue(rows)
      },
      evidencePack: { create: vi.fn() }
    };

    const storage = createAppStorage(prisma as any);
    const out = await storage.listInsightCards({
      sessionId: "session-1",
      limit: 20
    });

    expect(prisma.insightCard.findMany).toHaveBeenCalledWith({
      where: { sessionId: "session-1" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        sessionId: true,
        signalId: true,
        insightJson: true,
        createdAt: true
      }
    });
    expect(out).toEqual(rows);
  });
});

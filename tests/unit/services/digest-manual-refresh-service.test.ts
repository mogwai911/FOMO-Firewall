import { describe, expect, it, vi } from "vitest";
import {
  DigestManualRefreshServiceError,
  getDigestStatus,
  manualRefreshDigest
} from "@/lib/services/digest-manual-refresh-service";

describe("digest-manual-refresh-service", () => {
  it("runs ingestion + digest generation for first manual refresh", async () => {
    const runIngestion = vi.fn().mockResolvedValue({
      sources: 1,
      signals: 4,
      duplicates: 0,
      errors: []
    });
    const generateDigest = vi.fn().mockResolvedValue({
      dateKey: "2026-02-21",
      count: 3,
      signals: [{ id: "sig-1", triage: null }]
    });
    const prefetchSignalTriage = vi.fn().mockResolvedValue({
      requested: 1,
      generated: 1,
      failed: 0,
      errors: []
    });
    const prefetchSignalPreview = vi.fn().mockResolvedValue({
      requested: 1,
      generated: 1,
      failed: 0,
      errors: []
    });
    const upsertDigestRun = vi.fn().mockResolvedValue({
      dateKey: "2026-02-21",
      mode: "MANUAL",
      signalCount: 3,
      processedCount: 1,
      updatedAt: new Date("2026-02-21T01:00:00.000Z")
    });
    const upsertDigestSnapshot = vi.fn().mockResolvedValue({
      id: "snapshot-1",
      dateKey: "2026-02-21",
      windowDays: 1,
      signalIdsJson: ["sig-1"],
      refreshMetaJson: {},
      updatedAt: new Date("2026-02-21T01:00:00.000Z")
    });
    const countProcessedSignals = vi.fn().mockResolvedValue(1);

    const out = await manualRefreshDigest(
      {
        dateKey: "2026-02-21"
      },
      {
        findDigestSnapshot: vi.fn().mockResolvedValue(null),
        findDigestRun: vi.fn().mockResolvedValue(null),
        upsertDigestRun,
        upsertDigestSnapshot,
        runIngestion,
        generateDigest,
        prefetchSignalTriage,
        prefetchSignalPreview,
        resetDigestDataForDate: vi.fn(),
        countProcessedSignals
      } as any
    );

    expect(runIngestion).toHaveBeenCalledTimes(1);
    expect(generateDigest).toHaveBeenCalledWith({
      dateKey: "2026-02-21",
      limit: 100,
      role: "ENG",
      timezone: "UTC",
      windowDays: 1
    });
    expect(prefetchSignalTriage).toHaveBeenCalledWith({
      signalIds: ["sig-1"],
      role: "ENG"
    });
    expect(prefetchSignalPreview).toHaveBeenCalledWith({
      signalIds: ["sig-1"]
    });
    expect(generateDigest).toHaveBeenCalledTimes(2);
    expect(upsertDigestRun).toHaveBeenCalledWith({
      dateKey: "2026-02-21",
      mode: "MANUAL",
      signalCount: 3,
      processedCount: 1
    });
    expect(upsertDigestSnapshot).toHaveBeenCalledTimes(1);
    expect(out.status.hasDigest).toBe(true);
    expect(out.digest.count).toBe(3);
    expect(out.triageSummary.generated).toBe(1);
  });

  it("rejects refresh when digest exists and overwrite is false", async () => {
    await expect(
      manualRefreshDigest(
        {
          dateKey: "2026-02-21"
        },
        {
          findDigestSnapshot: vi.fn().mockResolvedValue({
            dateKey: "2026-02-21",
            windowDays: 1,
            signalIdsJson: ["sig-1", "sig-2", "sig-3"],
            refreshMetaJson: {},
            updatedAt: new Date("2026-02-21T01:00:00.000Z")
          }),
          findDigestRun: vi.fn().mockResolvedValue({
            dateKey: "2026-02-21",
            mode: "MANUAL",
            signalCount: 3,
            processedCount: 1,
            updatedAt: new Date("2026-02-21T01:00:00.000Z")
          }),
          upsertDigestSnapshot: vi.fn(),
          upsertDigestRun: vi.fn(),
          runIngestion: vi.fn(),
          generateDigest: vi.fn(),
          prefetchSignalPreview: vi.fn(),
          resetDigestDataForDate: vi.fn(),
          countProcessedSignals: vi.fn()
        } as any
      )
    ).rejects.toMatchObject<Partial<DigestManualRefreshServiceError>>({
      code: "DIGEST_ALREADY_EXISTS"
    });
  });

  it("resets dispositions/triage when overwrite + reset mode enabled", async () => {
    const resetDigestDataForDate = vi.fn().mockResolvedValue(undefined);
    await manualRefreshDigest(
      {
        dateKey: "2026-02-21",
        overwrite: true,
        resetMode: "RESET_DISPOSITIONS"
      },
      {
        findDigestSnapshot: vi.fn().mockResolvedValue({
          dateKey: "2026-02-21",
          windowDays: 1,
          signalIdsJson: ["sig-1"],
          refreshMetaJson: {},
          updatedAt: new Date("2026-02-21T01:00:00.000Z")
        }),
        findDigestRun: vi.fn().mockResolvedValue({
          dateKey: "2026-02-21",
          mode: "MANUAL",
          signalCount: 2,
          processedCount: 2,
          updatedAt: new Date("2026-02-21T01:00:00.000Z")
        }),
        upsertDigestRun: vi.fn().mockResolvedValue({
          dateKey: "2026-02-21",
          mode: "MANUAL",
          signalCount: 2,
          processedCount: 0,
          updatedAt: new Date("2026-02-21T02:00:00.000Z")
        }),
        runIngestion: vi.fn().mockResolvedValue({
          sources: 0,
          signals: 0,
          duplicates: 0,
          errors: []
        }),
        upsertDigestSnapshot: vi.fn(),
        generateDigest: vi.fn().mockResolvedValue({
          dateKey: "2026-02-21",
          count: 2,
          signals: []
        }),
        prefetchSignalTriage: vi.fn().mockResolvedValue({
          requested: 0,
          generated: 0,
          failed: 0,
          errors: []
        }),
        prefetchSignalPreview: vi.fn().mockResolvedValue({
          requested: 0,
          generated: 0,
          failed: 0,
          errors: []
        }),
        resetDigestDataForDate,
        countProcessedSignals: vi.fn().mockResolvedValue(0)
      } as any
    );

    expect(resetDigestDataForDate).toHaveBeenCalledWith("2026-02-21", "UTC", 1);
  });

  it("returns digest status when run record exists", async () => {
    const out = await getDigestStatus(
      { dateKey: "2026-02-21" },
      {
        findDigestSnapshot: vi.fn().mockResolvedValue({
          dateKey: "2026-02-21",
          windowDays: 1,
          signalIdsJson: ["sig-1", "sig-2", "sig-3", "sig-4", "sig-5"],
          refreshMetaJson: {},
          updatedAt: new Date("2026-02-21T09:30:00.000Z")
        }),
        findDigestRun: vi.fn().mockResolvedValue({
          dateKey: "2026-02-21",
          mode: "MANUAL",
          signalCount: 5,
          processedCount: 2,
          updatedAt: new Date("2026-02-21T09:30:00.000Z")
        })
      } as any
    );

    expect(out).toEqual({
      hasDigest: true,
      generatedAt: "2026-02-21T09:30:00.000Z",
      signalCount: 5,
      processedCount: 2
    });
  });

  it("passes digest history window to generator", async () => {
    const generateDigest = vi.fn().mockResolvedValue({
      dateKey: "2026-02-21",
      count: 2,
      signals: []
    });

    await manualRefreshDigest(
      {
        dateKey: "2026-02-21",
        windowDays: 3
      } as any,
      {
        findDigestSnapshot: vi.fn().mockResolvedValue(null),
        findDigestRun: vi.fn().mockResolvedValue(null),
        upsertDigestRun: vi.fn().mockResolvedValue({
          dateKey: "2026-02-21",
          mode: "MANUAL",
          signalCount: 2,
          processedCount: 0,
          updatedAt: new Date("2026-02-21T10:00:00.000Z")
        }),
        runIngestion: vi.fn().mockResolvedValue({
          sources: 1,
          signals: 2,
          duplicates: 0,
          errors: []
        }),
        upsertDigestSnapshot: vi.fn(),
        generateDigest,
        prefetchSignalTriage: vi.fn().mockResolvedValue({
          requested: 0,
          generated: 0,
          failed: 0,
          errors: []
        }),
        prefetchSignalPreview: vi.fn().mockResolvedValue({
          requested: 0,
          generated: 0,
          failed: 0,
          errors: []
        }),
        resetDigestDataForDate: vi.fn(),
        countProcessedSignals: vi.fn().mockResolvedValue(0)
      } as any
    );

    expect(generateDigest).toHaveBeenCalledWith({
      dateKey: "2026-02-21",
      limit: 100,
      role: "ENG",
      timezone: "UTC",
      windowDays: 3
    });
  });

  it("passes custom digest limit to generator", async () => {
    const generateDigest = vi.fn().mockResolvedValue({
      dateKey: "2026-02-21",
      count: 1,
      signals: []
    });

    await manualRefreshDigest(
      {
        dateKey: "2026-02-21",
        windowDays: 1,
        limit: 42
      } as any,
      {
        findDigestSnapshot: vi.fn().mockResolvedValue(null),
        findDigestRun: vi.fn().mockResolvedValue(null),
        upsertDigestRun: vi.fn().mockResolvedValue({
          dateKey: "2026-02-21",
          mode: "MANUAL",
          signalCount: 1,
          processedCount: 0,
          updatedAt: new Date("2026-02-21T10:00:00.000Z")
        }),
        runIngestion: vi.fn().mockResolvedValue({
          sources: 1,
          signals: 1,
          duplicates: 0,
          errors: []
        }),
        upsertDigestSnapshot: vi.fn(),
        generateDigest,
        prefetchSignalTriage: vi.fn().mockResolvedValue({
          requested: 0,
          generated: 0,
          failed: 0,
          errors: []
        }),
        prefetchSignalPreview: vi.fn().mockResolvedValue({
          requested: 0,
          generated: 0,
          failed: 0,
          errors: []
        }),
        resetDigestDataForDate: vi.fn(),
        countProcessedSignals: vi.fn().mockResolvedValue(0)
      } as any
    );

    expect(generateDigest).toHaveBeenCalledWith({
      dateKey: "2026-02-21",
      limit: 42,
      role: "ENG",
      timezone: "UTC",
      windowDays: 1
    });
  });
});

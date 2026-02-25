import { describe, expect, it, vi } from "vitest";
import { getDigestView } from "@/lib/services/digest-view-service";

describe("digest-view-service", () => {
  it("returns empty snapshot state when no digest snapshot exists", async () => {
    const out = await getDigestView(
      {
        dateKey: "2026-02-22",
        windowDays: 7
      },
      {
        findDigestSnapshot: vi.fn().mockResolvedValue(null),
        findDigestRun: vi.fn().mockResolvedValue({
          dateKey: "2026-02-22",
          mode: "MANUAL",
          signalCount: 9,
          processedCount: 4,
          updatedAt: new Date("2026-02-22T09:00:00.000Z")
        }),
        listSignalsByIds: vi.fn()
      } as any
    );

    expect(out.hasSnapshot).toBe(false);
    expect(out.digest.count).toBe(0);
    expect(out.legacyDigestRunExists).toBe(true);
    expect(out.legacyNotice).toContain("更新这段时间日报");
  });

  it("returns snapshot-ordered digest and consistent counts", async () => {
    const out = await getDigestView(
      {
        dateKey: "2026-02-22",
        windowDays: 1
      },
      {
        findDigestSnapshot: vi.fn().mockResolvedValue({
          id: "snapshot-1",
          dateKey: "2026-02-22",
          windowDays: 1,
          signalIdsJson: ["sig-2", "sig-1", "sig-3"],
          refreshMetaJson: {
              ingestion: {
                sources: 2,
                signals: 10,
                duplicates: 3,
                errors: 1,
                errorDetails: [
                  {
                    sourceId: "src-x",
                    sourceName: "Marcus on AI",
                    rssUrl: "https://garymarcus.substack.com/feed",
                    message: "FETCH_FAILED: connect timeout"
                  }
                ]
              },
            triage: {
              requested: 10,
              generated: 10,
              failed: 0
            }
          },
          updatedAt: new Date("2026-02-22T10:00:00.000Z")
        }),
        findDigestRun: vi.fn().mockResolvedValue(null),
        listSignalsByIds: vi.fn().mockResolvedValue([
          {
            id: "sig-1",
            title: "Signal 1",
            url: "https://example.com/1",
            summary: "Summary 1",
            publishedAt: new Date("2026-02-22T01:00:00.000Z"),
            source: { id: "src-1", name: "Source 1" },
            dispositions: [{ label: "FYI" }],
            triages: [{ triageJson: { label: "FYI", score: 12 } }]
          },
          {
            id: "sig-2",
            title: "Signal 2",
            url: "https://example.com/2",
            summary: "Summary 2",
            publishedAt: new Date("2026-02-22T02:00:00.000Z"),
            source: { id: "src-2", name: "Source 2" },
            dispositions: [],
            triages: [{ triageJson: { label: "DO", score: 98 } }]
          },
          {
            id: "sig-3",
            title: "Signal 3",
            url: "https://example.com/3",
            summary: "Summary 3",
            publishedAt: new Date("2026-02-22T03:00:00.000Z"),
            source: { id: "src-3", name: "Source 3" },
            dispositions: [{ label: "DROP" }],
            triages: [{ triageJson: { label: "DROP", score: 7 } }]
          }
        ])
      } as any
    );

    expect(out.hasSnapshot).toBe(true);
    expect(out.generatedAt).toBe("2026-02-22T10:00:00.000Z");
    expect(out.digest.signals.map((signal) => signal.id)).toEqual(["sig-2", "sig-1", "sig-3"]);
    expect(out.counts).toEqual({
      total: 3,
      pending: 1,
      processed: 2,
      later: 1,
      do: 0,
      drop: 1
    });
    expect(out.lastRefresh?.ingestion.sources).toBe(2);
    expect(out.lastRefresh?.ingestion.errors).toBe(1);
    expect(out.lastRefresh?.ingestion.errorDetails).toHaveLength(1);
    expect(out.lastRefresh?.ingestion.errorDetails?.[0]?.sourceName).toBe("Marcus on AI");
  });
});

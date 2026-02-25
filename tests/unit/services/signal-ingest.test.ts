import { describe, expect, it, vi } from "vitest";
import { ingestSignalsFromEnabledSources } from "@/lib/services/signal-ingest";

describe("signal-ingest service", () => {
  it("ingests entries and skips duplicates by source+url", async () => {
    const listEnabledSources = vi.fn().mockResolvedValue([
      { id: "src-1", rssUrl: "https://example.com/rss.xml" }
    ]);
    const fetchRssItems = vi.fn().mockResolvedValue([
      {
        title: "A",
        url: "https://example.com/a",
        guid: "a",
        summary: "summary-a",
        publishedAt: new Date("2026-02-20T00:00:00.000Z"),
        rawEntryJson: { title: "A" }
      },
      {
        title: "A duplicate",
        url: "https://example.com/a",
        guid: "a2",
        summary: "summary-a2",
        publishedAt: null,
        rawEntryJson: { title: "A duplicate" }
      },
      {
        title: "B",
        url: "https://example.com/b",
        guid: "b",
        summary: "summary-b",
        publishedAt: null,
        rawEntryJson: { title: "B" }
      }
    ]);
    const findSignalBySourceAndUrl = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const createSignal = vi.fn().mockResolvedValue({ id: "sig-new" });

    const out = await ingestSignalsFromEnabledSources({
      listEnabledSources,
      fetchRssItems,
      findSignalBySourceAndUrl,
      createSignal
    } as any);

    expect(out.sources).toBe(1);
    expect(out.signals).toBe(2);
    expect(out.duplicates).toBe(1);
    expect(out.errors).toHaveLength(0);
    expect(createSignal).toHaveBeenCalledTimes(2);
  });

  it("captures per-source fetch errors and continues", async () => {
    const listEnabledSources = vi.fn().mockResolvedValue([
      { id: "src-ok", rssUrl: "https://ok.example/rss.xml", name: "OK" },
      { id: "src-bad", rssUrl: "https://bad.example/rss.xml", name: "Bad" }
    ]);

    const fetchRssItems = vi
      .fn()
      .mockResolvedValueOnce([
        {
          title: "A",
          url: "https://ok.example/a",
          guid: "a",
          summary: null,
          publishedAt: null,
          rawEntryJson: {}
        }
      ])
      .mockRejectedValueOnce(new Error("fetch failed"));

    const findSignalBySourceAndUrl = vi.fn().mockResolvedValue(null);
    const createSignal = vi.fn().mockResolvedValue({ id: "sig-1" });

    const out = await ingestSignalsFromEnabledSources({
      listEnabledSources,
      fetchRssItems,
      findSignalBySourceAndUrl,
      createSignal
    } as any);

    expect(out.sources).toBe(2);
    expect(out.signals).toBe(1);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]?.sourceId).toBe("src-bad");
    expect(out.errors[0]?.sourceName).toBe("Bad");
    expect(out.errors[0]?.rssUrl).toBe("https://bad.example/rss.xml");
    expect(out.errors[0]?.message).toContain("fetch failed");
  });

  it("starts multiple source fetches concurrently when concurrency > 1", async () => {
    const listEnabledSources = vi.fn().mockResolvedValue([
      { id: "src-1", rssUrl: "https://s1.example/rss.xml", name: "S1" },
      { id: "src-2", rssUrl: "https://s2.example/rss.xml", name: "S2" },
      { id: "src-3", rssUrl: "https://s3.example/rss.xml", name: "S3" }
    ]);
    const pendingResolvers: Array<() => void> = [];
    const fetchRssItems = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          pendingResolvers.push(() => resolve([]));
        })
    );

    const runPromise = ingestSignalsFromEnabledSources(
      {
        listEnabledSources,
        fetchRssItems,
        findSignalBySourceAndUrl: vi.fn().mockResolvedValue(null),
        createSignal: vi.fn().mockResolvedValue({ id: "sig-1" })
      } as any,
      {
        concurrency: 3
      }
    );

    await Promise.resolve();
    expect(fetchRssItems).toHaveBeenCalledTimes(3);

    pendingResolvers.forEach((resolve) => resolve());
    const out = await runPromise;
    expect(out.sources).toBe(3);
    expect(out.errors).toHaveLength(0);
  });
});

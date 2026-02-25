import { describe, expect, it, vi } from "vitest";
import { listSources } from "@/lib/services/sources-service";

describe("sources-service defaults", () => {
  it("seeds default sources when source table is empty", async () => {
    const listSourcesMock = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "src-1",
          rssUrl: "https://www.jiqizhixin.com/rss",
          name: "机器之心",
          tagsJson: [],
          enabled: true,
          createdAt: new Date("2026-02-21T00:00:00.000Z"),
          updatedAt: new Date("2026-02-21T00:00:00.000Z")
        },
        {
          id: "src-2",
          rssUrl: "https://www.qbitai.com/feed",
          name: "量子位",
          tagsJson: [],
          enabled: true,
          createdAt: new Date("2026-02-21T00:00:00.000Z"),
          updatedAt: new Date("2026-02-21T00:00:00.000Z")
        }
      ]);
    const ensureDefaultSources = vi.fn().mockResolvedValue(undefined);

    const sources = await listSources({
      findByRssUrl: vi.fn(),
      findById: vi.fn(),
      createSource: vi.fn(),
      updateSourceEnabled: vi.fn(),
      deleteSource: vi.fn(),
      listSources: listSourcesMock,
      ensureDefaultSources
    } as any);

    expect(ensureDefaultSources).toHaveBeenCalledTimes(1);
    expect(sources).toHaveLength(2);
    expect(sources.map((source) => source.rssUrl)).toEqual([
      "https://www.jiqizhixin.com/rss",
      "https://www.qbitai.com/feed"
    ]);
  });

  it("does not seed default sources when existing rows exist", async () => {
    const ensureDefaultSources = vi.fn().mockResolvedValue(undefined);

    await listSources({
      findByRssUrl: vi.fn(),
      findById: vi.fn(),
      createSource: vi.fn(),
      updateSourceEnabled: vi.fn(),
      deleteSource: vi.fn(),
      listSources: vi.fn().mockResolvedValue([
        {
          id: "src-1",
          rssUrl: "https://custom.example/feed.xml",
          name: "Custom",
          tagsJson: [],
          enabled: true,
          createdAt: new Date("2026-02-21T00:00:00.000Z"),
          updatedAt: new Date("2026-02-21T00:00:00.000Z")
        }
      ]),
      ensureDefaultSources
    } as any);

    expect(ensureDefaultSources).not.toHaveBeenCalled();
  });
});

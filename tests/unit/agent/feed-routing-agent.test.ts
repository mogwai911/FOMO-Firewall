import { describe, expect, it } from "vitest";
import { routeFeedsForDigest } from "@/lib/agent/feed-routing-agent";

describe("feed-routing-agent", () => {
  it("deduplicates near-identical headlines and keeps higher scored signal", () => {
    const out = routeFeedsForDigest({
      role: "ENG",
      limit: 10,
      feeds: [
        {
          id: "sig-1",
          title: "OpenAI 发布新模型：API 兼容性变化",
          summary: "breaking changes and migration guide",
          sourceName: "Feed A",
          publishedAt: "2026-02-22T00:00:00.000Z",
          baseScore: 50
        },
        {
          id: "sig-2",
          title: "OpenAI发布新模型 API兼容性变化",
          summary: "breaking changes and migration guide",
          sourceName: "Feed B",
          publishedAt: "2026-02-22T00:01:00.000Z",
          baseScore: 70
        }
      ]
    });

    expect(out.items).toHaveLength(1);
    expect(out.items[0]?.id).toBe("sig-2");
  });

  it("assigns routing label and rank by role/actionability", () => {
    const out = routeFeedsForDigest({
      role: "ENG",
      limit: 10,
      feeds: [
        {
          id: "sig-fyi",
          title: "行业观察周报",
          summary: "资讯汇总",
          sourceName: "News",
          publishedAt: "2026-02-22T00:00:00.000Z",
          baseScore: 60
        },
        {
          id: "sig-do",
          title: "Runtime breaking change",
          summary: "migration required",
          sourceName: "Official Changelog",
          publishedAt: "2026-02-22T00:00:00.000Z",
          baseScore: 60
        },
        {
          id: "sig-drop",
          title: "Rumor: 神秘模型泄露",
          summary: "纯猜测",
          sourceName: "Unknown",
          publishedAt: "2026-02-22T00:00:00.000Z",
          baseScore: 60
        }
      ]
    });

    expect(out.items[0]?.id).toBe("sig-do");
    expect(out.byId["sig-do"]?.label).toBe("DO");
    expect(out.byId["sig-fyi"]?.label).toBe("FYI");
    expect(out.byId["sig-drop"]?.label).toBe("DROP");
  });
});

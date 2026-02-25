import { describe, expect, it, vi } from "vitest";
import { generateDigestForDate } from "@/lib/services/digest-service";

describe("digest-service", () => {
  it("prioritizes score and feedback over pure recency", async () => {
    const deps = {
      listSignalsForDate: vi.fn().mockResolvedValue([
        {
          id: "sig-new-low",
          title: "普通更新",
          url: "https://example.com/new",
          summary: "常规信息",
          publishedAt: new Date("2026-02-20T10:00:00.000Z"),
          createdAt: new Date("2026-02-20T10:00:00.000Z"),
          source: { id: "src-1", name: "General Feed", tagsJson: null },
          dispositions: [],
          triages: [{ triageJson: { score: 42 } }]
        },
        {
          id: "sig-old-high",
          title: "关键 breaking 变更",
          url: "https://example.com/old",
          summary: "需要尽快验证",
          publishedAt: new Date("2026-02-20T06:00:00.000Z"),
          createdAt: new Date("2026-02-20T06:00:00.000Z"),
          source: { id: "src-2", name: "Official Changelog", tagsJson: ["official"] },
          dispositions: [],
          triages: [{ triageJson: { score: 85 } }]
        }
      ]),
      listSourceFeedback: vi.fn().mockResolvedValue({
        "src-2": { sessionEntered: 2, jobsRequested: 1 }
      })
    };

    const out = await generateDigestForDate(
      {
        dateKey: "2026-02-20",
        role: "ENG"
      },
      deps as any
    );

    expect(out.signals[0].id).toBe("sig-old-high");
  });

  it("applies role preference in ranking", async () => {
    const deps = {
      listSignalsForDate: vi.fn().mockResolvedValue([
        {
          id: "sig-roadmap",
          title: "Roadmap update for Q2",
          url: "https://example.com/pm",
          summary: "影响产品节奏",
          publishedAt: new Date("2026-02-20T09:00:00.000Z"),
          createdAt: new Date("2026-02-20T09:00:00.000Z"),
          source: { id: "src-1", name: "Blog", tagsJson: null },
          dispositions: [],
          triages: [{ triageJson: { score: 60 } }]
        },
        {
          id: "sig-runtime",
          title: "Runtime internals detail",
          url: "https://example.com/eng",
          summary: "实现细节",
          publishedAt: new Date("2026-02-20T09:00:00.000Z"),
          createdAt: new Date("2026-02-20T09:00:00.000Z"),
          source: { id: "src-2", name: "Blog", tagsJson: null },
          dispositions: [],
          triages: [{ triageJson: { score: 60 } }]
        }
      ]),
      listSourceFeedback: vi.fn().mockResolvedValue({})
    };

    const out = await generateDigestForDate(
      {
        dateKey: "2026-02-20",
        role: "PM"
      },
      deps as any
    );

    expect(out.signals[0].id).toBe("sig-roadmap");
  });

  it("uses timezone day window instead of fixed UTC day", async () => {
    const listSignalsForDate = vi.fn().mockResolvedValue([]);
    const deps = {
      listSignalsForDate,
      listSourceFeedback: vi.fn().mockResolvedValue({})
    };

    await generateDigestForDate(
      {
        dateKey: "2026-02-21",
        role: "ENG",
        timezone: "Asia/Shanghai"
      } as any,
      deps as any
    );

    const [start, endExclusive] = listSignalsForDate.mock.calls[0];
    expect(start.toISOString()).toBe("2026-02-20T16:00:00.000Z");
    expect(endExclusive.toISOString()).toBe("2026-02-21T16:00:00.000Z");
  });

  it("supports multi-day digest window for recent history", async () => {
    const listSignalsForDate = vi.fn().mockResolvedValue([]);
    const deps = {
      listSignalsForDate,
      listSourceFeedback: vi.fn().mockResolvedValue({})
    };

    await generateDigestForDate(
      {
        dateKey: "2026-02-21",
        role: "ENG",
        timezone: "UTC",
        windowDays: 7
      } as any,
      deps as any
    );

    const [start, endExclusive] = listSignalsForDate.mock.calls[0];
    expect(start.toISOString()).toBe("2026-02-15T00:00:00.000Z");
    expect(endExclusive.toISOString()).toBe("2026-02-22T00:00:00.000Z");
  });

  it("routes and deduplicates feeds before returning digest", async () => {
    const deps = {
      listSignalsForDate: vi.fn().mockResolvedValue([
        {
          id: "sig-1",
          title: "OpenAI 发布新模型：API 兼容性变化",
          url: "https://example.com/a",
          summary: "breaking migration",
          publishedAt: new Date("2026-02-20T10:00:00.000Z"),
          createdAt: new Date("2026-02-20T10:00:00.000Z"),
          source: { id: "src-1", name: "A", tagsJson: null },
          dispositions: [],
          triages: [{ triageJson: { score: 50 } }]
        },
        {
          id: "sig-2",
          title: "OpenAI发布新模型 API兼容性变化",
          url: "https://example.com/b",
          summary: "breaking migration",
          publishedAt: new Date("2026-02-20T10:01:00.000Z"),
          createdAt: new Date("2026-02-20T10:01:00.000Z"),
          source: { id: "src-2", name: "B", tagsJson: null },
          dispositions: [],
          triages: [{ triageJson: { score: 70 } }]
        }
      ]),
      listSourceFeedback: vi.fn().mockResolvedValue({})
    };

    const out = await generateDigestForDate(
      {
        dateKey: "2026-02-20",
        role: "ENG"
      },
      deps as any
    );

    expect(out.signals).toHaveLength(1);
    expect(out.signals[0]?.id).toBe("sig-2");
    expect(out.signals[0]?.routing.label).toBe("DO");
  });
});

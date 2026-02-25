import { describe, expect, it, vi } from "vitest";
import {
  SignalPreviewServiceError,
  buildSignalPreview
} from "@/lib/services/signal-preview-service";

describe("signal-preview-service", () => {
  it("returns cached preview without calling article fetch and llm", async () => {
    const fetchArticleExcerpt = vi.fn();
    const summarizeWithLlm = vi.fn();
    const out = await buildSignalPreview(
      {
        signalId: "sig-1"
      },
      {
        findSignal: vi.fn().mockResolvedValue({
          id: "sig-1",
          title: "美团技术文章",
          url: "https://tech.meituan.com/2026/02/10/demo.html",
          summary: "rss summary",
          source: {
            name: "美团技术团队"
          }
        }),
        findPreviewCache: vi.fn().mockResolvedValue({
          signalId: "sig-1",
          originalUrl: "https://tech.meituan.com/2026/02/10/demo.html",
          aiSummary: "缓存中的AI总结",
          aiSummaryMode: "LLM",
          articleContent: "缓存原文摘录",
          warningsJson: ["cached-warning"],
          generatedAt: new Date("2026-02-22T00:00:00.000Z")
        }),
        upsertPreviewCache: vi.fn(),
        fetchArticleExcerpt,
        summarizeWithLlm,
        now: () => new Date("2026-02-22T01:00:00.000Z")
      } as any
    );

    expect(out.aiSummary).toBe("缓存中的AI总结");
    expect(out.articleContent).toBe("缓存原文摘录");
    expect(out.warnings).toEqual(["cached-warning"]);
    expect(fetchArticleExcerpt).not.toHaveBeenCalled();
    expect(summarizeWithLlm).not.toHaveBeenCalled();
  });

  it("rebuilds legacy truncated heuristic cache to provide full summary", async () => {
    const fetchArticleExcerpt = vi.fn().mockResolvedValue(
      "这是重建后的原文摘要内容，用于替换旧版被截断的缓存。".repeat(8)
    );
    const summarizeWithLlm = vi.fn().mockRejectedValue(new Error("llm request failed"));
    const upsertPreviewCache = vi.fn();

    const out = await buildSignalPreview(
      {
        signalId: "sig-legacy"
      },
      {
        findSignal: vi.fn().mockResolvedValue({
          id: "sig-legacy",
          title: "旧缓存重建测试",
          url: "https://example.com/legacy",
          summary: "旧摘要",
          source: { name: "测试源" }
        }),
        findPreviewCache: vi.fn().mockResolvedValue({
          signalId: "sig-legacy",
          originalUrl: "https://example.com/legacy",
          aiSummary: "这是一条旧版缓存的摘要...",
          aiSummaryMode: "HEURISTIC",
          articleContent: "旧缓存原文",
          warningsJson: [],
          generatedAt: new Date("2026-02-21T00:00:00.000Z")
        }),
        upsertPreviewCache,
        fetchArticleExcerpt,
        summarizeWithLlm,
        now: () => new Date("2026-02-22T00:00:00.000Z")
      } as any
    );

    expect(out.aiSummaryMode).toBe("HEURISTIC");
    expect(out.aiSummary.endsWith("...")).toBe(false);
    expect(fetchArticleExcerpt).toHaveBeenCalledTimes(1);
    expect(summarizeWithLlm).toHaveBeenCalledTimes(1);
    expect(upsertPreviewCache).toHaveBeenCalledTimes(1);
  });

  it("returns llm summary with fetched article content", async () => {
    const upsertPreviewCache = vi.fn();
    const out = await buildSignalPreview(
      {
        signalId: "sig-1"
      },
      {
        findSignal: vi.fn().mockResolvedValue({
          id: "sig-1",
          title: "美团技术文章",
          url: "https://tech.meituan.com/2026/02/10/demo.html",
          summary: "rss summary",
          source: {
            name: "美团技术团队"
          }
        }),
        findPreviewCache: vi.fn().mockResolvedValue(null),
        upsertPreviewCache,
        fetchArticleExcerpt: vi.fn().mockResolvedValue("这是原文正文摘录"),
        summarizeWithLlm: vi.fn().mockResolvedValue("这是 AI 总结"),
        now: () => new Date("2026-02-22T00:00:00.000Z")
      } as any
    );

    expect(out.signalId).toBe("sig-1");
    expect(out.aiSummary).toBe("这是 AI 总结");
    expect(out.aiSummaryMode).toBe("LLM");
    expect(out.articleContent).toContain("正文");
    expect(out.originalUrl).toBe("https://tech.meituan.com/2026/02/10/demo.html");
    expect(upsertPreviewCache).toHaveBeenCalledWith({
      signalId: "sig-1",
      originalUrl: "https://tech.meituan.com/2026/02/10/demo.html",
      aiSummary: "这是 AI 总结",
      aiSummaryMode: "LLM",
      articleContent: "这是原文正文摘录",
      warnings: [],
      generatedAt: new Date("2026-02-22T00:00:00.000Z")
    });
  });

  it("falls back when article fetch or llm summary fails", async () => {
    const upsertPreviewCache = vi.fn();
    const out = await buildSignalPreview(
      {
        signalId: "sig-1"
      },
      {
        findSignal: vi.fn().mockResolvedValue({
          id: "sig-1",
          title: "美团技术文章",
          url: "https://tech.meituan.com/2026/02/10/demo.html",
          summary: "rss summary fallback",
          source: {
            name: "美团技术团队"
          }
        }),
        findPreviewCache: vi.fn().mockResolvedValue(null),
        upsertPreviewCache,
        fetchArticleExcerpt: vi.fn().mockRejectedValue(new Error("article fetch failed: 403")),
        summarizeWithLlm: vi.fn().mockRejectedValue(new Error("llm request failed")),
        now: () => new Date("2026-02-22T00:00:00.000Z")
      } as any
    );

    expect(out.aiSummaryMode).toBe("HEURISTIC");
    expect(out.articleContent).toBeNull();
    expect(out.aiSummary.length).toBeGreaterThan(0);
    expect(out.warnings.length).toBeGreaterThan(0);
    expect(out.originalUrl).toBe("https://tech.meituan.com/2026/02/10/demo.html");
    expect(upsertPreviewCache).toHaveBeenCalled();
  });

  it("keeps full heuristic fallback summary text without hard truncation", async () => {
    const longSummary =
      "这是一段很长的 RSS 摘要，用于验证 fallback 不应被裁剪。".repeat(12);

    const out = await buildSignalPreview(
      { signalId: "sig-2" },
      {
        findSignal: vi.fn().mockResolvedValue({
          id: "sig-2",
          title: "长摘要测试",
          url: "https://example.com/sig-2",
          summary: longSummary,
          source: { name: "测试源" }
        }),
        findPreviewCache: vi.fn().mockResolvedValue(null),
        upsertPreviewCache: vi.fn(),
        fetchArticleExcerpt: vi.fn().mockRejectedValue(new Error("article fetch failed")),
        summarizeWithLlm: vi.fn().mockRejectedValue(new Error("llm request failed")),
        now: () => new Date("2026-02-22T00:00:00.000Z")
      } as any
    );

    expect(out.aiSummaryMode).toBe("HEURISTIC");
    expect(longSummary.length).toBeGreaterThan(140);
    expect(out.aiSummary).toBe(longSummary);
    expect(out.aiSummary.endsWith("...")).toBe(false);
  });

  it("throws not found for missing signal", async () => {
    await expect(
      buildSignalPreview(
        {
          signalId: "missing"
        },
        {
          findSignal: vi.fn().mockResolvedValue(null),
          findPreviewCache: vi.fn(),
          upsertPreviewCache: vi.fn(),
          fetchArticleExcerpt: vi.fn(),
          summarizeWithLlm: vi.fn(),
          now: () => new Date("2026-02-22T00:00:00.000Z")
        } as any
      )
    ).rejects.toMatchObject({
      code: "SIGNAL_NOT_FOUND"
    } as Partial<SignalPreviewServiceError>);
  });
});

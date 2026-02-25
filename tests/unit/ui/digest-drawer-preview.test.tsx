import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DigestDrawer } from "@/components/digest-drawer";

const signal = {
  id: "sig-1",
  title: "美团发布新模型",
  url: "https://fallback.example.com/article",
  summary: "rss summary",
  publishedAt: "2026-02-10T00:00:00.000Z",
  source: {
    id: "src-1",
    name: "美团技术"
  },
  disposition: null,
  triage: null,
  routing: {
    label: "DO" as const,
    score: 95
  }
};

describe("DigestDrawer preview rendering", () => {
  it("renders AI summary, article content and prefers preview originalUrl", () => {
    const html = renderToStaticMarkup(
      <DigestDrawer
        signal={signal}
        triage={null}
        preview={{
          aiSummary: "这是 AI 总结",
          aiSummaryMode: "LLM",
          articleContent: "这是原文正文内容",
          originalUrl: "https://tech.meituan.com/2026/02/10/longcat-flash-lite.html",
          warnings: []
        }}
        previewLoading={false}
        previewError={null}
        userDisposition="UNSET"
        isGenerating={false}
        onClose={vi.fn()}
        onSetDisposition={vi.fn()}
        onGenerateTriage={vi.fn()}
      />
    );

    expect(html).toContain("这是 AI 总结");
    expect(html).toContain("这是原文正文内容");
    expect(html).toContain("打开原文链接");
    expect(html).toContain('href="https://tech.meituan.com/2026/02/10/longcat-flash-lite.html"');
    expect(html).toContain('data-testid="digest-drawer-overlay"');
    expect(html).toContain('data-testid="digest-drawer-backdrop"');
    expect(html).toContain('data-testid="digest-drawer-summary-section"');
    expect(html).toContain('data-testid="digest-drawer-original-section"');
  });

  it("uses AI summary as quote content and supports original-content collapse toggle", () => {
    const html = renderToStaticMarkup(
      <DigestDrawer
        signal={signal}
        triage={{
          label: "FYI",
          headline: "一句话结论",
          reasons: [
            {
              type: "relevance",
              text: "与当前目标相关性一般",
              confidence: 0.6
            }
          ],
          snippets: [
            {
              text: "旧引用片段",
              source: "rss_summary"
            }
          ],
          nextActionHint: "BOOKMARK",
          score: 40
        }}
        preview={{
          aiSummary: "这是用于引用展示的 AI 总结",
          aiSummaryMode: "LLM",
          articleContent:
            "这是很长的原文内容，用于测试折叠显示能力。这是很长的原文内容，用于测试折叠显示能力。这是很长的原文内容，用于测试折叠显示能力。",
          originalUrl: "https://tech.meituan.com/2026/02/10/longcat-flash-lite.html",
          warnings: []
        }}
        previewLoading={false}
        previewError={null}
        userDisposition="UNSET"
        isGenerating={false}
        onClose={vi.fn()}
        onSetDisposition={vi.fn()}
        onGenerateTriage={vi.fn()}
      />
    );

    expect(html).toContain("价值判断");
    expect(html).toContain("建议动作");
    expect(html).toContain("稍后看");
    expect(html).not.toContain("核心结论");
    expect(html).not.toContain("判断理由");
    expect(html).toContain("引用片段");
    expect(html).toContain("这是用于引用展示的 AI 总结");
    expect(html).not.toContain("旧引用片段");
    expect(html).toContain("展开原文内容");
    expect(html).toContain('data-testid="digest-drawer-reason-section"');
  });

  it("shows llm config hint when preview falls back to heuristic mode", () => {
    const html = renderToStaticMarkup(
      <DigestDrawer
        signal={signal}
        triage={null}
        preview={{
          aiSummary: "这是降级后的摘要",
          aiSummaryMode: "HEURISTIC",
          articleContent: "原文摘录",
          originalUrl: "https://example.com/post",
          warnings: ["llm config missing"]
        }}
        previewLoading={false}
        previewError={null}
        userDisposition="UNSET"
        isGenerating={false}
        onClose={vi.fn()}
        onSetDisposition={vi.fn()}
        onGenerateTriage={vi.fn()}
      />
    );

    expect(html).toContain("未配置 LLM API Key");
  });
});

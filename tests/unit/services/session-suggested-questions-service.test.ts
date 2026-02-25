import { describe, expect, it, vi } from "vitest";
import {
  SessionSuggestedQuestionsServiceError,
  generateSessionSuggestedQuestions
} from "@/lib/services/session-suggested-questions-service";

describe("session-suggested-questions-service", () => {
  it("returns llm-generated questions grounded in feed content", async () => {
    const completeWithLlm = vi
      .fn()
      .mockResolvedValue(
        `{"questions":["Kimi K2.5 的多智能体编排在什么任务边界下最容易失效？","如果只做一个验证，应该优先验证长上下文压缩的哪项指标？","这篇 feed 里哪些工程细节决定了它是否值得立刻深入学习？"]}`
      );
    const out = await generateSessionSuggestedQuestions(
      {
        sessionId: "session-1"
      },
      {
        getSession: vi.fn().mockResolvedValue({
          id: "session-1",
          signal: {
            id: "signal-1",
            title: "月之暗面发布 Kimi K2.5",
            summary: "主打长上下文与多智能体协作",
            url: "https://example.com/kimi",
            source: { id: "source-1", name: "量子位" }
          },
          status: "ACTIVE",
          createdAt: "2026-02-24T00:00:00.000Z",
          updatedAt: "2026-02-24T00:00:00.000Z",
          messages: [],
          jobs: []
        }),
        buildPreview: vi.fn().mockResolvedValue({
          signalId: "signal-1",
          title: "月之暗面发布 Kimi K2.5",
          sourceName: "量子位",
          originalUrl: "https://example.com/kimi",
          aiSummary: "Kimi K2.5 强调多智能体编排与长上下文压缩能力。",
          aiSummaryMode: "LLM",
          articleContent: "文章讨论了多智能体任务分解、上下文压缩与工程落地。",
          warnings: [],
          generatedAt: "2026-02-24T00:00:00.000Z"
        }),
        getSettings: vi.fn().mockResolvedValue({
          schedule: { enabled: false, time: "09:00", timezone: "UTC" },
          apiConfig: {
            baseUrl: "https://api.openai.com/v1",
            apiKey: "key",
            model: "gpt-4o-mini"
          },
          prompts: { triage: "", sessionAssistant: "", suggestedQuestions: "自定义提问模板 {{signalTitle}}" },
          updatedAt: "2026-02-24T00:00:00.000Z"
        }),
        completeWithLlm,
        resolveModel: () => "gpt-4o-mini"
      } as any
    );

    expect(out.mode).toBe("LLM");
    expect(out.questions).toHaveLength(3);
    expect(out.questions[0]).toContain("Kimi K2.5");
    expect(completeWithLlm).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("自定义提问模板 月之暗面发布 Kimi K2.5")
      })
    );
  });

  it("falls back to heuristic questions when llm fails", async () => {
    const out = await generateSessionSuggestedQuestions(
      {
        sessionId: "session-1"
      },
      {
        getSession: vi.fn().mockResolvedValue({
          id: "session-1",
          signal: {
            id: "signal-1",
            title: "月之暗面发布 Kimi K2.5",
            summary: "主打长上下文与多智能体协作",
            url: "https://example.com/kimi",
            source: { id: "source-1", name: "量子位" }
          },
          status: "ACTIVE",
          createdAt: "2026-02-24T00:00:00.000Z",
          updatedAt: "2026-02-24T00:00:00.000Z",
          messages: [],
          jobs: []
        }),
        buildPreview: vi.fn().mockResolvedValue({
          signalId: "signal-1",
          title: "月之暗面发布 Kimi K2.5",
          sourceName: "量子位",
          originalUrl: "https://example.com/kimi",
          aiSummary: "Kimi K2.5 强调多智能体编排与长上下文压缩能力。",
          aiSummaryMode: "LLM",
          articleContent: "文章讨论了多智能体任务分解、上下文压缩与工程落地。",
          warnings: [],
          generatedAt: "2026-02-24T00:00:00.000Z"
        }),
        getSettings: vi.fn().mockResolvedValue({
          schedule: { enabled: false, time: "09:00", timezone: "UTC" },
          apiConfig: {
            baseUrl: "https://api.openai.com/v1",
            apiKey: "key",
            model: "gpt-4o-mini"
          },
          prompts: { triage: "", sessionAssistant: "", suggestedQuestions: "" },
          updatedAt: "2026-02-24T00:00:00.000Z"
        }),
        completeWithLlm: vi.fn().mockRejectedValue(new Error("llm failed")),
        resolveModel: () => "gpt-4o-mini"
      } as any
    );

    expect(out.mode).toBe("HEURISTIC");
    expect(out.questions).toHaveLength(3);
    expect(out.questions.join(" ")).toContain("Kimi");
  });

  it("throws not found when session is missing", async () => {
    await expect(
      generateSessionSuggestedQuestions(
        {
          sessionId: "missing"
        },
        {
          getSession: vi.fn().mockResolvedValue(null)
        } as any
      )
    ).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND"
    } as Partial<SessionSuggestedQuestionsServiceError>);
  });
});

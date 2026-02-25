import { describe, expect, it, vi } from "vitest";
import { createInsightCardWithProvider } from "@/lib/llm/insight-card-provider";

describe("insight-card-provider", () => {
  it("parses llm json into v2 insight contract", async () => {
    const out = await createInsightCardWithProvider(
      {
        signalTitle: "OpenAI update",
        signalSummary: "summary",
        messages: [{ role: "USER", content: "讲讲这条信息的关键价值" }]
      },
      {
        getSettings: vi.fn().mockResolvedValue({
          schedule: { enabled: false, time: "09:00", timezone: "UTC" },
          apiConfig: { baseUrl: "https://example.com/v1", apiKey: "k", model: "gpt-4o-mini" },
          prompts: { triage: "", sessionAssistant: "", suggestedQuestions: "" },
          updatedAt: "2026-02-24T00:00:00.000Z"
        }),
        completeWithLlm: vi.fn().mockResolvedValue(
          JSON.stringify({
            abstract: "这是摘要",
            key_points: ["要点一", "要点二", "要点三"],
            evidence: [{ text: "证据A", from: "conversation" }],
            limitations: ["样本不足"]
          })
        )
      } as any
    );

    expect(out.version).toBe(2);
    expect(out.signal_title).toBe("OpenAI update");
    expect(out.abstract).toContain("摘要");
    expect(out.key_points.length).toBeGreaterThanOrEqual(3);
    expect(out.evidence.length).toBeGreaterThanOrEqual(1);
    expect(out.limitations.length).toBeGreaterThanOrEqual(1);
  });

  it("falls back to heuristic v2 contract when llm fails", async () => {
    const out = await createInsightCardWithProvider(
      {
        signalTitle: "OpenAI update",
        signalSummary: "summary",
        messages: [{ role: "ASSISTANT", content: "结论：先做小范围验证" }]
      },
      {
        getSettings: vi.fn().mockResolvedValue({
          schedule: { enabled: false, time: "09:00", timezone: "UTC" },
          apiConfig: { baseUrl: "https://example.com/v1", apiKey: "k", model: "gpt-4o-mini" },
          prompts: { triage: "", sessionAssistant: "", suggestedQuestions: "" },
          updatedAt: "2026-02-24T00:00:00.000Z"
        }),
        completeWithLlm: vi.fn().mockRejectedValue(new Error("llm down"))
      } as any
    );

    expect(out.version).toBe(2);
    expect(out.abstract.length).toBeGreaterThan(0);
    expect(out.key_points.length).toBeGreaterThanOrEqual(1);
    expect(out.evidence.length).toBeGreaterThanOrEqual(1);
    expect(out.limitations.length).toBeGreaterThanOrEqual(1);
    expect(out).not.toHaveProperty("next_action");
  });
});

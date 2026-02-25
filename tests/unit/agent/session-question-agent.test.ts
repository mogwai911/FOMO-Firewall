import { describe, expect, it } from "vitest";
import { generateSessionQuestionCards } from "@/lib/agent/session-question-agent";

describe("session-question-agent", () => {
  it("generates exactly 3 starter questions from ai summary context", () => {
    const cards = generateSessionQuestionCards({
      signal: {
        title: "Next.js 16 发布",
        summary: "包含缓存策略更新和路由行为变化。",
        aiSummary: "升级后缓存命中策略变化，关键风险在路由缓存与数据一致性。"
      },
      messages: []
    });

    expect(cards).toHaveLength(3);
    expect(cards[0]).toContain("验证动作");
    expect(cards[0]).toContain("缓存");
    expect(cards.join(" ")).not.toContain("如果今天只做一件事，我应该先验证哪个指标？");
  });

  it("still generates 3 focused cards after user messages", () => {
    const cards = generateSessionQuestionCards({
      signal: {
        title: "OpenAI API 更新",
        summary: "新增模型和响应格式。",
        aiSummary: "重点是接口结构变化和错误处理迁移。"
      },
      messages: [
        {
          role: "USER",
          content: "请先给我迁移路径"
        },
        {
          role: "ASSISTANT",
          content: "可以先盘点旧接口调用点。"
        }
      ]
    });

    expect(cards).toHaveLength(3);
    expect(cards[0]).toContain("迁移路径");
    expect(new Set(cards).size).toBe(cards.length);
  });
});

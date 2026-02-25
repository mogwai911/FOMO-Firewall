import { describe, expect, it } from "vitest";
import { generateHeuristicTriageCard } from "@/lib/agent/triage-agent";

describe("triage-agent", () => {
  it("classifies actionable update as DO with bounded fields", () => {
    const card = generateHeuristicTriageCard(
      {
        title: "OpenAI release migration guide",
        summary: "Includes breaking changes and rollout steps.",
        sourceName: "OpenAI Blog"
      },
      "ENG"
    );

    expect(card.label).toBe("DO");
    expect(card.headline).toContain("建议：去学习");
    expect(card.reasons.length).toBeLessThanOrEqual(3);
    expect(card.snippets.length).toBeLessThanOrEqual(2);
    expect(card.next_action_hint).toBe("ENTER_SESSION");
  });

  it("classifies rumor-style content as DROP", () => {
    const card = generateHeuristicTriageCard(
      {
        title: "Rumor: model leak",
        summary: "Speculation repost with no first-party evidence.",
        sourceName: "Unknown"
      },
      "PM"
    );

    expect(card.label).toBe("DROP");
    expect(card.headline).toContain("建议：忽略");
    expect(card.next_action_hint).toBe("DISMISS");
  });

  it("emits role-specific guidance in reasons", () => {
    const signal = {
      title: "API release migration notes",
      summary: "Breaking changes and rollout details.",
      sourceName: "OpenAI Blog"
    };

    const pmCard = generateHeuristicTriageCard(signal, "PM");
    const engCard = generateHeuristicTriageCard(signal, "ENG");
    const resCard = generateHeuristicTriageCard(signal, "RES");

    expect(pmCard.reasons[0]?.text).toContain("路线图");
    expect(engCard.reasons[0]?.text).toContain("实现");
    expect(resCard.reasons[0]?.text).toContain("证据");
  });
});

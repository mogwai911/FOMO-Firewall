import { describe, expect, it } from "vitest";
import { buildTriagePrompt } from "@/lib/prompts/triage";
import { buildSessionAssistantPrompt } from "@/lib/prompts/session-assistant";

describe("prompt template override", () => {
  it("triage uses customPromptTemplate when provided", () => {
    const out = buildTriagePrompt({
      role: "ENG",
      title: "Title A",
      summary: "Summary A",
      sourceName: "Source A",
      url: "https://example.com/a",
      extractedText: "Extracted A",
      customPromptTemplate: "CUSTOM_TRIAGE {{title}} {{summary}}"
    });

    expect(out).toContain("CUSTOM_TRIAGE Title A Summary A");
  });

  it("session assistant uses customPromptTemplate when provided", () => {
    const out = buildSessionAssistantPrompt({
      signal: {
        title: "Title B",
        summary: "Summary B",
        url: "https://example.com/b",
        sourceName: "Source B",
        articleExcerpt: "Excerpt B"
      },
      history: [],
      currentUserMessage: "hello",
      customPromptTemplate: "CUSTOM_SESSION {{signalTitle}} {{signalSummary}}"
    });

    expect(out[0]?.role).toBe("system");
    expect(out[0]?.content).toContain("CUSTOM_SESSION Title B Summary B");
  });
});

import { describe, expect, it, vi } from "vitest";
import { sanitizeReleaseState } from "@/lib/services/release-sanitize-service";
import {
  DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE,
  DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE,
  DEFAULT_TRIAGE_PROMPT_TEMPLATE
} from "@/lib/prompts/default-templates";

describe("release-sanitize-service", () => {
  it("adds missing default sources and keeps existing ones", async () => {
    const deps = {
      listSources: vi.fn().mockResolvedValue([
        {
          id: "s-custom",
          rssUrl: "https://example.com/feed.xml",
          name: "Custom",
          tagsJson: [],
          enabled: true,
          createdAt: new Date("2026-02-25T00:00:00.000Z"),
          updatedAt: new Date("2026-02-25T00:00:00.000Z")
        },
        {
          id: "s-qbitai",
          rssUrl: "https://www.qbitai.com/feed",
          name: "量子位",
          tagsJson: [],
          enabled: true,
          createdAt: new Date("2026-02-25T00:00:00.000Z"),
          updatedAt: new Date("2026-02-25T00:00:00.000Z")
        }
      ]),
      createSource: vi.fn().mockResolvedValue(undefined),
      findSettings: vi.fn().mockResolvedValue({
        id: "default",
        scheduleEnabled: false,
        scheduleTime: "09:00",
        timezone: "UTC",
        apiBaseUrl: "https://api.example.com/v1",
        apiKey: "encrypted-value",
        apiModel: "o3-mini",
        triagePromptTemplate: "custom-triage",
        sessionAssistantPromptTemplate: "custom-session",
        suggestedQuestionsPromptTemplate: "custom-questions",
        updatedAt: new Date("2026-02-25T00:00:00.000Z")
      }),
      upsertSettings: vi.fn().mockResolvedValue(undefined)
    };

    const result = await sanitizeReleaseState(deps as any);

    expect(deps.createSource).toHaveBeenCalledTimes(1);
    expect(deps.createSource).toHaveBeenCalledWith({
      rssUrl: "https://www.jiqizhixin.com/rss",
      name: "机器之心",
      tags: ["ai", "china"]
    });
    expect(result.addedDefaultSources).toBe(1);
  });

  it("clears llm api config while preserving schedule and prompt templates", async () => {
    const deps = {
      listSources: vi.fn().mockResolvedValue([]),
      createSource: vi.fn().mockResolvedValue(undefined),
      findSettings: vi.fn().mockResolvedValue({
        id: "default",
        scheduleEnabled: true,
        scheduleTime: "08:30",
        timezone: "Asia/Shanghai",
        apiBaseUrl: "https://api.example.com/v1",
        apiKey: "encrypted-value",
        apiModel: "gpt-4.1-mini",
        triagePromptTemplate: "custom-triage",
        sessionAssistantPromptTemplate: "custom-session",
        suggestedQuestionsPromptTemplate: "custom-questions",
        updatedAt: new Date("2026-02-25T00:00:00.000Z")
      }),
      upsertSettings: vi.fn().mockResolvedValue(undefined)
    };

    await sanitizeReleaseState(deps as any);

    expect(deps.upsertSettings).toHaveBeenCalledWith({
      scheduleEnabled: true,
      scheduleTime: "08:30",
      timezone: "Asia/Shanghai",
      apiBaseUrl: "",
      apiKey: "",
      apiModel: "",
      triagePromptTemplate: "custom-triage",
      sessionAssistantPromptTemplate: "custom-session",
      suggestedQuestionsPromptTemplate: "custom-questions"
    });
  });

  it("creates default settings when settings row does not exist", async () => {
    const deps = {
      listSources: vi.fn().mockResolvedValue([]),
      createSource: vi.fn().mockResolvedValue(undefined),
      findSettings: vi.fn().mockResolvedValue(null),
      upsertSettings: vi.fn().mockResolvedValue(undefined)
    };

    await sanitizeReleaseState(deps as any);

    expect(deps.upsertSettings).toHaveBeenCalledWith({
      scheduleEnabled: false,
      scheduleTime: "09:00",
      timezone: "UTC",
      apiBaseUrl: "",
      apiKey: "",
      apiModel: "",
      triagePromptTemplate: DEFAULT_TRIAGE_PROMPT_TEMPLATE,
      sessionAssistantPromptTemplate: DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE,
      suggestedQuestionsPromptTemplate: DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE
    });
  });
});

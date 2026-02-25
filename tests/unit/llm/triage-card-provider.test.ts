import { describe, expect, it, vi } from "vitest";
import {
  createOpenAICompatibleTriageCardProvider,
  createRemoteTriageCardProvider,
  resolveTriageCardProvider
} from "@/lib/llm/triage-card-provider";

describe("triage-card-provider", () => {
  it("uses heuristic provider by default", async () => {
    const provider = resolveTriageCardProvider({});
    const card = await provider.generate({
      role: "ENG",
      title: "Migration guide",
      summary: "contains steps",
      sourceName: "Docs"
    });
    expect(card.label).toBeTruthy();
  });

  it("uses remote provider when configured", async () => {
    const provider = resolveTriageCardProvider(
      {
        TRIAGE_PROVIDER: "remote",
        TRIAGE_LLM_URL: "https://llm.example.com/triage",
        TRIAGE_LLM_API_KEY: "key"
      },
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          label: "DO",
          headline: "建议 DO",
          reasons: [
            {
              type: "relevance",
              text: "x",
              confidence: 0.8
            }
          ],
          snippets: [],
          next_action_hint: "ENTER_SESSION",
          score: 80
        })
      }) as any
    );

    const card = await provider.generate({
      role: "ENG",
      title: "Migration guide",
      summary: "contains steps",
      sourceName: "Docs"
    });
    expect(card.label).toBe("DO");
  });

  it("uses openai-compatible provider when configured with base url", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                label: "FYI",
                headline: "建议 FYI",
                reasons: [
                  {
                    type: "relevance",
                    text: "x",
                    confidence: 0.7
                  }
                ],
                snippets: [],
                next_action_hint: "BOOKMARK",
                score: 61
              })
            }
          }
        ]
      })
    });

    const provider = resolveTriageCardProvider(
      {
        mode: "remote",
        url: "https://api.openai.com/v1",
        apiKey: "key",
        model: "gpt-4o-mini"
      },
      fetchMock as any
    );

    const card = await provider.generate({
      role: "ENG",
      title: "Migration guide",
      summary: "contains steps",
      sourceName: "Docs",
      promptTemplate: "请更关注可执行性：{{title}}"
    });

    expect(card.label).toBe("FYI");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST"
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      messages: Array<{ content: string }>;
    };
    const userMessage = body.messages.at(-1)?.content ?? "";
    expect(userMessage).toContain("请更关注可执行性");
  });

  it("remote provider throws on malformed payload", async () => {
    const provider = createRemoteTriageCardProvider(
      {
        url: "https://llm.example.com/triage",
        apiKey: ""
      },
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          unknown: true
        })
      }) as any
    );

    await expect(
      provider.generate({
        role: "ENG",
        title: "x",
        summary: null,
        sourceName: null
      })
    ).rejects.toThrowError("invalid triage payload");
  });

  it("openai-compatible provider throws when model output is not JSON", async () => {
    const provider = createOpenAICompatibleTriageCardProvider(
      {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "key",
        model: "gpt-4o-mini"
      },
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "not-json"
              }
            }
          ]
        })
      }) as any
    );

    await expect(
      provider.generate({
        role: "ENG",
        title: "x",
        summary: null,
        sourceName: null
      })
    ).rejects.toThrowError("invalid triage payload");
  });

  it("openai-compatible provider parses fenced json and normalizes next_action_hint by label", async () => {
    const provider = createOpenAICompatibleTriageCardProvider(
      {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "key",
        model: "gpt-4o-mini"
      },
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: [
                  "```json",
                  JSON.stringify({
                    label: "DO",
                    headline: "价值判断：可形成动作。建议：去学习。",
                    reasons: [
                      {
                        type: "relevance",
                        text: "价值明确",
                        confidence: 0.8
                      }
                    ],
                    snippets: [],
                    next_action_hint: "BOOKMARK",
                    score: 78
                  }),
                  "```"
                ].join("\n")
              }
            }
          ]
        })
      }) as any
    );

    const card = await provider.generate({
      role: "ENG",
      title: "x",
      summary: null,
      sourceName: null
    });
    expect(card.label).toBe("DO");
    expect(card.next_action_hint).toBe("ENTER_SESSION");
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  SessionAssistantStreamServiceError,
  streamSessionAssistantReply
} from "@/lib/services/session-assistant-stream-service";
import { LlmStreamError } from "@/lib/llm/openai-chat-stream-client";

describe("session-assistant-stream-service", () => {
  it("prefers model configured in app settings over fallback resolver", async () => {
    const streamChat = vi.fn().mockImplementation(async function* () {
      yield "ok";
    });

    for await (const _event of streamSessionAssistantReply(
      {
        sessionId: "session-1",
        role: "user",
        content: "请总结重点"
      },
      {
        getSession: vi.fn().mockResolvedValue({
          id: "session-1",
          signal: {
            id: "signal-1",
            title: "Signal",
            summary: "Summary",
            url: "https://example.com/article",
            source: {
              id: "source-1",
              name: "Source"
            }
          },
          status: "ACTIVE",
          createdAt: "2026-02-21T00:00:00.000Z",
          updatedAt: "2026-02-21T00:00:00.000Z",
          messages: [],
          jobs: []
        }),
        appendMessage: vi
          .fn()
          .mockResolvedValueOnce({
            id: "u1",
            sessionId: "session-1",
            role: "USER",
            content: "请总结重点",
            metaJson: null,
            createdAt: "2026-02-21T00:00:00.000Z"
          })
          .mockResolvedValueOnce({
            id: "a1",
            sessionId: "session-1",
            role: "ASSISTANT",
            content: "ok",
            metaJson: null,
            createdAt: "2026-02-21T00:00:01.000Z"
          }),
        getSettings: vi.fn().mockResolvedValue({
          schedule: {
            enabled: false,
            time: "09:00",
            timezone: "UTC"
          },
          apiConfig: {
            baseUrl: "https://api.openai.com/v1",
            apiKey: "key",
            model: "o3-mini"
          },
          prompts: {
            triage: "",
            sessionAssistant: ""
          },
          updatedAt: "2026-02-21T00:00:00.000Z"
        }),
        streamChat,
        resolveModel: () => "gpt-4o-mini",
        fetchArticleExcerpt: vi.fn().mockResolvedValue("article excerpt")
      }
    )) {
      // noop
    }

    expect(streamChat).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "o3-mini"
      })
    );
  });

  it("emits ack -> delta* -> done and persists assistant once", async () => {
    const appendMessage = vi
      .fn()
      .mockResolvedValueOnce({
        id: "user-msg-1",
        sessionId: "session-1",
        role: "USER",
        content: "请帮我梳理重点",
        metaJson: null,
        createdAt: "2026-02-21T00:00:00.000Z"
      })
      .mockResolvedValueOnce({
        id: "assistant-msg-1",
        sessionId: "session-1",
        role: "ASSISTANT",
        content: "Hello",
        metaJson: null,
        createdAt: "2026-02-21T00:00:01.000Z"
      });

    const streamChat = vi.fn().mockImplementation(async function* () {
      yield "Hel";
      yield "lo";
    });

    const events = [] as Array<{ type: string }>;
    for await (const event of streamSessionAssistantReply(
      {
        sessionId: "session-1",
        role: "user",
        content: "请帮我梳理重点"
      },
      {
        getSession: vi.fn().mockResolvedValue({
          id: "session-1",
          signal: {
            id: "signal-1",
            title: "Signal",
            summary: "Summary",
            url: "https://example.com",
            source: {
              id: "source-1",
              name: "Source"
            }
          },
          status: "ACTIVE",
          createdAt: "2026-02-21T00:00:00.000Z",
          updatedAt: "2026-02-21T00:00:00.000Z",
          messages: [],
          jobs: []
        }),
        appendMessage,
        getSettings: vi.fn().mockResolvedValue({
          schedule: {
            enabled: false,
            time: "09:00",
            timezone: "UTC"
          },
          apiConfig: {
            baseUrl: "https://api.openai.com/v1",
            apiKey: "key",
            model: "gpt-4o-mini"
          },
          prompts: {
            triage: "",
            sessionAssistant: ""
          },
          updatedAt: "2026-02-21T00:00:00.000Z"
        }),
        streamChat,
        resolveModel: () => "gpt-4o-mini",
        fetchArticleExcerpt: vi.fn().mockResolvedValue("article excerpt")
      }
    )) {
      events.push({ type: event.type });
    }

    expect(events.map((event) => event.type)).toEqual(["ack", "delta", "delta", "done"]);
    expect(appendMessage).toHaveBeenCalledTimes(2);
    expect(appendMessage).toHaveBeenNthCalledWith(2, {
      sessionId: "session-1",
      role: "assistant",
      content: "Hello"
    });
    expect(streamChat).toHaveBeenCalledTimes(1);
  });

  it("emits ack then error when llm request fails and keeps user message", async () => {
    const appendMessage = vi.fn().mockResolvedValue({
      id: "user-msg-1",
      sessionId: "session-1",
      role: "USER",
      content: "hello",
      metaJson: null,
      createdAt: "2026-02-21T00:00:00.000Z"
    });

    const streamChat = vi.fn().mockImplementation(async function* () {
      throw new LlmStreamError("LLM_REQUEST_FAILED", "401", 401);
    });

    const events = [] as Array<{ type: string; code?: string }>;
    for await (const event of streamSessionAssistantReply(
      {
        sessionId: "session-1",
        role: "user",
        content: "hello"
      },
      {
        getSession: vi.fn().mockResolvedValue({
          id: "session-1",
          signal: {
            id: "signal-1",
            title: "Signal",
            summary: "Summary",
            url: "https://example.com",
            source: {
              id: "source-1",
              name: "Source"
            }
          },
          status: "ACTIVE",
          createdAt: "2026-02-21T00:00:00.000Z",
          updatedAt: "2026-02-21T00:00:00.000Z",
          messages: [],
          jobs: []
        }),
        appendMessage,
        getSettings: vi.fn().mockResolvedValue({
          schedule: {
            enabled: false,
            time: "09:00",
            timezone: "UTC"
          },
          apiConfig: {
            baseUrl: "https://api.openai.com/v1",
            apiKey: "key",
            model: "gpt-4o-mini"
          },
          prompts: {
            triage: "",
            sessionAssistant: ""
          },
          updatedAt: "2026-02-21T00:00:00.000Z"
        }),
        streamChat,
        resolveModel: () => "gpt-4o-mini",
        fetchArticleExcerpt: vi.fn().mockResolvedValue("article excerpt")
      }
    )) {
      events.push({ type: event.type, code: event.type === "error" ? event.code : undefined });
    }

    expect(events).toEqual([
      { type: "ack", code: undefined },
      { type: "error", code: "LLM_REQUEST_FAILED" }
    ]);
    expect(appendMessage).toHaveBeenCalledTimes(1);
  });

  it("falls back to non-stream completion when stream fetch fails before first delta", async () => {
    const appendMessage = vi
      .fn()
      .mockResolvedValueOnce({
        id: "user-msg-1",
        sessionId: "session-1",
        role: "USER",
        content: "hello",
        metaJson: null,
        createdAt: "2026-02-21T00:00:00.000Z"
      })
      .mockResolvedValueOnce({
        id: "assistant-msg-1",
        sessionId: "session-1",
        role: "ASSISTANT",
        content: "这是 fallback 回复",
        metaJson: null,
        createdAt: "2026-02-21T00:00:01.000Z"
      });

    const streamChat = vi.fn().mockImplementation(async function* () {
      throw new Error("fetch failed");
    });
    const completeChat = vi.fn().mockResolvedValue("这是 fallback 回复");

    const events = [] as Array<{ type: string; code?: string }>;
    for await (const event of streamSessionAssistantReply(
      {
        sessionId: "session-1",
        role: "user",
        content: "hello"
      },
      {
        getSession: vi.fn().mockResolvedValue({
          id: "session-1",
          signal: {
            id: "signal-1",
            title: "Signal",
            summary: "Summary",
            url: "https://example.com",
            source: {
              id: "source-1",
              name: "Source"
            }
          },
          status: "ACTIVE",
          createdAt: "2026-02-21T00:00:00.000Z",
          updatedAt: "2026-02-21T00:00:00.000Z",
          messages: [],
          jobs: []
        }),
        appendMessage,
        getSettings: vi.fn().mockResolvedValue({
          schedule: {
            enabled: false,
            time: "09:00",
            timezone: "UTC"
          },
          apiConfig: {
            baseUrl: "https://api.openai.com/v1",
            apiKey: "key",
            model: "gpt-4o-mini"
          },
          prompts: {
            triage: "",
            sessionAssistant: ""
          },
          updatedAt: "2026-02-21T00:00:00.000Z"
        }),
        streamChat,
        completeChat,
        resolveModel: () => "gpt-4o-mini",
        fetchArticleExcerpt: vi.fn().mockResolvedValue("article excerpt")
      } as any
    )) {
      events.push({ type: event.type, code: event.type === "error" ? event.code : undefined });
    }

    expect(events).toEqual([
      { type: "ack", code: undefined },
      { type: "done", code: undefined }
    ]);
    expect(streamChat).toHaveBeenCalledTimes(1);
    expect(completeChat).toHaveBeenCalledTimes(1);
    expect(appendMessage).toHaveBeenCalledTimes(2);
    expect(appendMessage).toHaveBeenNthCalledWith(2, {
      sessionId: "session-1",
      role: "assistant",
      content: "这是 fallback 回复"
    });
  });

  it("emits ack then config error when llm base url/key are missing", async () => {
    const appendMessage = vi.fn().mockResolvedValue({
      id: "user-msg-1",
      sessionId: "session-1",
      role: "USER",
      content: "hello",
      metaJson: null,
      createdAt: "2026-02-21T00:00:00.000Z"
    });

    const events = [] as Array<{ type: string; code?: string }>;
    for await (const event of streamSessionAssistantReply(
      {
        sessionId: "session-1",
        role: "user",
        content: "hello"
      },
      {
        getSession: vi.fn().mockResolvedValue({
          id: "session-1",
          signal: {
            id: "signal-1",
            title: "Signal",
            summary: "Summary",
            url: "https://example.com",
            source: {
              id: "source-1",
              name: "Source"
            }
          },
          status: "ACTIVE",
          createdAt: "2026-02-21T00:00:00.000Z",
          updatedAt: "2026-02-21T00:00:00.000Z",
          messages: [],
          jobs: []
        }),
        appendMessage,
        getSettings: vi.fn().mockResolvedValue({
          schedule: {
            enabled: false,
            time: "09:00",
            timezone: "UTC"
          },
          apiConfig: {
            baseUrl: "",
            apiKey: "",
            model: ""
          },
          prompts: {
            triage: "",
            sessionAssistant: ""
          },
          updatedAt: "2026-02-21T00:00:00.000Z"
        }),
        streamChat: vi.fn(),
        resolveModel: () => "gpt-4o-mini",
        fetchArticleExcerpt: vi.fn().mockResolvedValue("article excerpt")
      }
    )) {
      events.push({ type: event.type, code: event.type === "error" ? event.code : undefined });
    }

    expect(events).toEqual([
      { type: "ack", code: undefined },
      { type: "error", code: "LLM_CONFIG_MISSING" }
    ]);
    expect(appendMessage).toHaveBeenCalledTimes(1);
  });

  it("throws SESSION_NOT_FOUND before ack when session does not exist", async () => {
    const run = async () => {
      for await (const _event of streamSessionAssistantReply(
        {
          sessionId: "session-missing",
          role: "user",
          content: "hello"
        },
        {
          getSession: vi.fn().mockResolvedValue(null),
          appendMessage: vi.fn(),
          getSettings: vi.fn(),
          streamChat: vi.fn(),
          resolveModel: () => "gpt-4o-mini",
          fetchArticleExcerpt: vi.fn().mockResolvedValue("article excerpt")
        }
      )) {
        // noop
      }
    };

    await expect(run()).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND"
    } as Partial<SessionAssistantStreamServiceError>);
  });

  it("injects fetched article excerpt into llm prompt messages", async () => {
    const streamChat = vi.fn().mockImplementation(async function* () {
      yield "done";
    });
    const fetchArticleExcerpt = vi
      .fn()
      .mockResolvedValue("这是从原文抓取到的正文片段，用于学习助手提供更准确建议。");

    for await (const _event of streamSessionAssistantReply(
      {
        sessionId: "session-1",
        role: "user",
        content: "请总结重点"
      },
      {
        getSession: vi.fn().mockResolvedValue({
          id: "session-1",
          signal: {
            id: "signal-1",
            title: "Signal",
            summary: "Summary",
            url: "https://example.com/article",
            source: {
              id: "source-1",
              name: "Source"
            }
          },
          status: "ACTIVE",
          createdAt: "2026-02-21T00:00:00.000Z",
          updatedAt: "2026-02-21T00:00:00.000Z",
          messages: [],
          jobs: []
        }),
        appendMessage: vi
          .fn()
          .mockResolvedValueOnce({
            id: "u1",
            sessionId: "session-1",
            role: "USER",
            content: "请总结重点",
            metaJson: null,
            createdAt: "2026-02-21T00:00:00.000Z"
          })
          .mockResolvedValueOnce({
            id: "a1",
            sessionId: "session-1",
            role: "ASSISTANT",
            content: "done",
            metaJson: null,
            createdAt: "2026-02-21T00:00:01.000Z"
          }),
        getSettings: vi.fn().mockResolvedValue({
          schedule: {
            enabled: false,
            time: "09:00",
            timezone: "UTC"
          },
          apiConfig: {
            baseUrl: "https://api.openai.com/v1",
            apiKey: "key",
            model: "gpt-4o-mini"
          },
          prompts: {
            triage: "",
            sessionAssistant: ""
          },
          updatedAt: "2026-02-21T00:00:00.000Z"
        }),
        streamChat,
        resolveModel: () => "gpt-4o-mini",
        fetchArticleExcerpt
      }
    )) {
      // noop
    }

    expect(fetchArticleExcerpt).toHaveBeenCalledWith("https://example.com/article");
    const payload = streamChat.mock.calls[0]?.[0];
    expect(JSON.stringify(payload.messages)).toContain("正文片段");
  });

  it("continues with summary-only context when article fetch fails", async () => {
    const streamChat = vi.fn().mockImplementation(async function* () {
      yield "ok";
    });
    const fetchArticleExcerpt = vi.fn().mockRejectedValue(new Error("HTTP 403"));

    const events: string[] = [];
    for await (const event of streamSessionAssistantReply(
      {
        sessionId: "session-1",
        role: "user",
        content: "继续"
      },
      {
        getSession: vi.fn().mockResolvedValue({
          id: "session-1",
          signal: {
            id: "signal-1",
            title: "Signal",
            summary: "Summary",
            url: "https://example.com/article",
            source: {
              id: "source-1",
              name: "Source"
            }
          },
          status: "ACTIVE",
          createdAt: "2026-02-21T00:00:00.000Z",
          updatedAt: "2026-02-21T00:00:00.000Z",
          messages: [],
          jobs: []
        }),
        appendMessage: vi
          .fn()
          .mockResolvedValueOnce({
            id: "u1",
            sessionId: "session-1",
            role: "USER",
            content: "继续",
            metaJson: null,
            createdAt: "2026-02-21T00:00:00.000Z"
          })
          .mockResolvedValueOnce({
            id: "a1",
            sessionId: "session-1",
            role: "ASSISTANT",
            content: "ok",
            metaJson: null,
            createdAt: "2026-02-21T00:00:01.000Z"
          }),
        getSettings: vi.fn().mockResolvedValue({
          schedule: {
            enabled: false,
            time: "09:00",
            timezone: "UTC"
          },
          apiConfig: {
            baseUrl: "https://api.openai.com/v1",
            apiKey: "key",
            model: "gpt-4o-mini"
          },
          prompts: {
            triage: "",
            sessionAssistant: ""
          },
          updatedAt: "2026-02-21T00:00:00.000Z"
        }),
        streamChat,
        resolveModel: () => "gpt-4o-mini",
        fetchArticleExcerpt
      }
    )) {
      events.push(event.type);
    }

    expect(events).toEqual(["ack", "delta", "done"]);
    expect(fetchArticleExcerpt).toHaveBeenCalledTimes(1);
    const payload = streamChat.mock.calls[0]?.[0];
    expect(JSON.stringify(payload.messages)).toContain("信号摘要：Summary");
  });

  it("injects custom session prompt template from settings", async () => {
    const streamChat = vi.fn().mockImplementation(async function* () {
      yield "ok";
    });

    for await (const _event of streamSessionAssistantReply(
      {
        sessionId: "session-1",
        role: "user",
        content: "继续"
      },
      {
        getSession: vi.fn().mockResolvedValue({
          id: "session-1",
          signal: {
            id: "signal-1",
            title: "Signal",
            summary: "Summary",
            url: "https://example.com/article",
            source: {
              id: "source-1",
              name: "Source"
            }
          },
          status: "ACTIVE",
          createdAt: "2026-02-21T00:00:00.000Z",
          updatedAt: "2026-02-21T00:00:00.000Z",
          messages: [],
          jobs: []
        }),
        appendMessage: vi
          .fn()
          .mockResolvedValueOnce({
            id: "u1",
            sessionId: "session-1",
            role: "USER",
            content: "继续",
            metaJson: null,
            createdAt: "2026-02-21T00:00:00.000Z"
          })
          .mockResolvedValueOnce({
            id: "a1",
            sessionId: "session-1",
            role: "ASSISTANT",
            content: "ok",
            metaJson: null,
            createdAt: "2026-02-21T00:00:01.000Z"
          }),
        getSettings: vi.fn().mockResolvedValue({
          schedule: {
            enabled: false,
            time: "09:00",
            timezone: "UTC"
          },
          apiConfig: {
            baseUrl: "https://api.openai.com/v1",
            apiKey: "key",
            model: "gpt-4o-mini"
          },
          prompts: {
            triage: "",
            sessionAssistant: "请使用中文，并以三步结构回答。线索标题：{{signalTitle}}"
          },
          updatedAt: "2026-02-21T00:00:00.000Z"
        }),
        streamChat,
        resolveModel: () => "gpt-4o-mini",
        fetchArticleExcerpt: vi.fn().mockResolvedValue("")
      }
    )) {
      // noop
    }

    const payload = streamChat.mock.calls[0]?.[0];
    expect(JSON.stringify(payload.messages)).toContain("请使用中文，并以三步结构回答");
    expect(JSON.stringify(payload.messages)).toContain("Signal");
  });
});

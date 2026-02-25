import { describe, expect, it, vi } from "vitest";
import {
  buildChatEndpoint,
  LlmStreamError,
  streamChatCompletions
} from "@/lib/llm/openai-chat-stream-client";

function createReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });
}

describe("openai-chat-stream-client", () => {
  it("builds chat endpoint from base url", () => {
    expect(buildChatEndpoint("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1/chat/completions"
    );
    expect(buildChatEndpoint("https://api.openai.com/v1/chat/completions")).toBe(
      "https://api.openai.com/v1/chat/completions"
    );
  });

  it("streams content deltas and stops at [DONE]", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createReadableStream([
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n',
        "data: [DONE]\n"
      ])
    });

    const chunks: string[] = [];
    for await (const delta of streamChatCompletions(
      {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "key",
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Hi" }]
      },
      fetchMock as unknown as typeof fetch
    )) {
      chunks.push(delta);
    }

    expect(chunks.join("")).toBe("Hello");
  });

  it("parses deltas even when SSE line is split across chunks", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createReadableStream([
        'data: {"choices":[{"delta":',
        '{"content":"A"}}]}\n',
        'data: {"choices":[{"delta":{"content":"B"}}]}\n',
        "data: [DONE]\n"
      ])
    });

    const chunks: string[] = [];
    for await (const delta of streamChatCompletions(
      {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "key",
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Hi" }]
      },
      fetchMock as unknown as typeof fetch
    )) {
      chunks.push(delta);
    }

    expect(chunks.join("")).toBe("AB");
  });

  it("throws LLM_REQUEST_FAILED on non-2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401
    });

    const run = async () => {
      for await (const _chunk of streamChatCompletions(
        {
          baseUrl: "https://api.openai.com/v1",
          apiKey: "bad-key",
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "Hi" }]
        },
        fetchMock as unknown as typeof fetch
      )) {
        // noop
      }
    };

    await expect(run()).rejects.toMatchObject({
      code: "LLM_REQUEST_FAILED"
    } as Partial<LlmStreamError>);
  });

  it("throws LLM_STREAM_PARSE_FAILED on empty response body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: null
    });

    const run = async () => {
      for await (const _chunk of streamChatCompletions(
        {
          baseUrl: "https://api.openai.com/v1",
          apiKey: "key",
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "Hi" }]
        },
        fetchMock as unknown as typeof fetch
      )) {
        // noop
      }
    };

    await expect(run()).rejects.toMatchObject({
      code: "LLM_STREAM_PARSE_FAILED"
    } as Partial<LlmStreamError>);
  });

  it("throws LLM_CONFIG_MISSING when base url or key is missing", async () => {
    const run = async () => {
      for await (const _chunk of streamChatCompletions(
        {
          baseUrl: "",
          apiKey: "",
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "Hi" }]
        },
        fetch
      )) {
        // noop
      }
    };

    await expect(run()).rejects.toMatchObject({
      code: "LLM_CONFIG_MISSING"
    } as Partial<LlmStreamError>);
  });
});

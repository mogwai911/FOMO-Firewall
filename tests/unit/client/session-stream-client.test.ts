import { describe, expect, it, vi } from "vitest";
import { AppApiError, streamSessionAssistantReply } from "@/lib/client/app-api";

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

describe("session stream client", () => {
  it("parses ack/delta/done events and forwards payload", async () => {
    const events: string[] = [];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createReadableStream([
        'event: ack\ndata: {"userMessage":{"id":"u1","sessionId":"s1","role":"USER","content":"hello","metaJson":null,"createdAt":"2026-02-21T00:00:00.000Z"}}\n\n',
        'event: delta\ndata: {"text":"Hel"}\n\n',
        'event: delta\ndata: {"text":"lo"}\n\n',
        'event: done\ndata: {"assistantMessage":{"id":"a1","sessionId":"s1","role":"ASSISTANT","content":"Hello","metaJson":null,"createdAt":"2026-02-21T00:00:01.000Z"}}\n\n'
      ])
    });

    await streamSessionAssistantReply(
      {
        sessionId: "s1",
        content: "hello",
        onAck: (payload) => events.push(`ack:${payload.userMessage.id}`),
        onDelta: (payload) => events.push(`delta:${payload.text}`),
        onDone: (payload) => events.push(`done:${payload.assistantMessage.id}`)
      },
      fetchMock as unknown as typeof fetch
    );

    expect(events).toEqual(["ack:u1", "delta:Hel", "delta:lo", "done:a1"]);
  });

  it("forwards error event without throwing", async () => {
    const onError = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createReadableStream([
        'event: ack\ndata: {"userMessage":{"id":"u1","sessionId":"s1","role":"USER","content":"hello","metaJson":null,"createdAt":"2026-02-21T00:00:00.000Z"}}\n\n',
        'event: error\ndata: {"code":"LLM_CONFIG_MISSING","message":"missing"}\n\n'
      ])
    });

    await streamSessionAssistantReply(
      {
        sessionId: "s1",
        content: "hello",
        onError
      },
      fetchMock as unknown as typeof fetch
    );

    expect(onError).toHaveBeenCalledWith({
      code: "LLM_CONFIG_MISSING",
      message: "missing"
    });
  });

  it("throws AppApiError on non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        error: "SESSION_NOT_FOUND",
        message: "session not found"
      })
    });

    await expect(
      streamSessionAssistantReply(
        {
          sessionId: "missing",
          content: "hello"
        },
        fetchMock as unknown as typeof fetch
      )
    ).rejects.toBeInstanceOf(AppApiError);
  });
});

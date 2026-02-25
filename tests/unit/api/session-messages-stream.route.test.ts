import { describe, expect, it, vi } from "vitest";
import {
  createSessionMessagesStreamPostHandler,
  SessionMessagesStreamRouteError
} from "@/app/api/sessions/[id]/messages/stream/route";

describe("session messages stream route", () => {
  it("returns 400 when role is not user", async () => {
    const streamReply = vi.fn();
    const assertSessionExists = vi.fn();
    const handler = createSessionMessagesStreamPostHandler({
      streamReply,
      assertSessionExists
    } as any);

    const req = new Request("http://localhost/api/sessions/s1/messages/stream", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        role: "assistant",
        content: "hello"
      })
    });

    const res = await handler(req, { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(400);
    expect(streamReply).not.toHaveBeenCalled();
  });

  it("returns 404 when session does not exist", async () => {
    const streamReply = vi.fn();
    const assertSessionExists = vi
      .fn()
      .mockRejectedValue(new SessionMessagesStreamRouteError("SESSION_NOT_FOUND", "not found"));
    const handler = createSessionMessagesStreamPostHandler({
      streamReply,
      assertSessionExists
    } as any);

    const req = new Request("http://localhost/api/sessions/s1/messages/stream", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        role: "user",
        content: "hello"
      })
    });

    const res = await handler(req, { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(404);
    expect(streamReply).not.toHaveBeenCalled();
  });

  it("streams ack/delta/done events", async () => {
    const handler = createSessionMessagesStreamPostHandler({
      assertSessionExists: vi.fn().mockResolvedValue(undefined),
      streamReply: vi.fn().mockImplementation(async function* () {
        yield {
          type: "ack",
          userMessage: {
            id: "user-1",
            sessionId: "s1",
            role: "USER",
            content: "hello",
            metaJson: null,
            createdAt: "2026-02-21T00:00:00.000Z"
          }
        };
        yield {
          type: "delta",
          text: "Hel"
        };
        yield {
          type: "done",
          assistantMessage: {
            id: "assistant-1",
            sessionId: "s1",
            role: "ASSISTANT",
            content: "Hello",
            metaJson: null,
            createdAt: "2026-02-21T00:00:01.000Z"
          }
        };
      })
    } as any);

    const req = new Request("http://localhost/api/sessions/s1/messages/stream", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        role: "user",
        content: "hello"
      })
    });

    const res = await handler(req, { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const bodyText = await res.text();
    expect(bodyText).toContain("event: ack");
    expect(bodyText).toContain("event: delta");
    expect(bodyText).toContain("event: done");
    expect(bodyText).toContain('"id":"assistant-1"');
  });

  it("streams ack then error event when llm fails", async () => {
    const handler = createSessionMessagesStreamPostHandler({
      assertSessionExists: vi.fn().mockResolvedValue(undefined),
      streamReply: vi.fn().mockImplementation(async function* () {
        yield {
          type: "ack",
          userMessage: {
            id: "user-1",
            sessionId: "s1",
            role: "USER",
            content: "hello",
            metaJson: null,
            createdAt: "2026-02-21T00:00:00.000Z"
          }
        };
        yield {
          type: "error",
          code: "LLM_REQUEST_FAILED",
          message: "401"
        };
      })
    } as any);

    const req = new Request("http://localhost/api/sessions/s1/messages/stream", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        role: "user",
        content: "hello"
      })
    });

    const res = await handler(req, { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(200);

    const bodyText = await res.text();
    expect(bodyText).toContain("event: ack");
    expect(bodyText).toContain("event: error");
    expect(bodyText).not.toContain("event: done");
  });
});

import {
  assertSessionExists,
  SessionAssistantStreamServiceError,
  streamSessionAssistantReply,
  type SessionAssistantStreamEvent
} from "@/lib/services/session-assistant-stream-service";

interface SessionMessagesStreamRouteContext {
  params:
    | Promise<{
        id: string;
      }>
    | {
        id: string;
      };
}

interface SessionMessagesStreamRouteDeps {
  assertSessionExists: (sessionId: string) => Promise<void>;
  streamReply: (input: {
    sessionId: string;
    role: "user";
    content: string;
    metaJson?: unknown;
    signal?: AbortSignal;
  }) => AsyncGenerator<SessionAssistantStreamEvent>;
}

interface SessionStreamBody {
  role?: unknown;
  content?: unknown;
  metaJson?: unknown;
}

export class SessionMessagesStreamRouteError extends Error {
  code: "SESSION_NOT_FOUND" | "INVALID_PAYLOAD";

  constructor(code: "SESSION_NOT_FOUND" | "INVALID_PAYLOAD", message: string) {
    super(message);
    this.code = code;
  }
}

function mapServiceError(error: unknown): SessionMessagesStreamRouteError | null {
  if (error instanceof SessionMessagesStreamRouteError) {
    return error;
  }

  if (error instanceof SessionAssistantStreamServiceError) {
    if (error.code === "SESSION_NOT_FOUND") {
      return new SessionMessagesStreamRouteError("SESSION_NOT_FOUND", error.message);
    }
    return new SessionMessagesStreamRouteError("INVALID_PAYLOAD", error.message);
  }

  return null;
}

async function resolveSessionId(context: SessionMessagesStreamRouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

function parseBody(body: SessionStreamBody): {
  role: "user";
  content: string;
  metaJson?: unknown;
} | null {
  if (body.role !== "user") {
    return null;
  }

  if (typeof body.content !== "string" || body.content.trim().length === 0) {
    return null;
  }

  return {
    role: "user",
    content: body.content.trim(),
    metaJson: body.metaJson
  };
}

function toSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function statusFromRouteError(error: SessionMessagesStreamRouteError): number {
  if (error.code === "SESSION_NOT_FOUND") {
    return 404;
  }
  return 400;
}

export function createSessionMessagesStreamPostHandler(
  deps: SessionMessagesStreamRouteDeps = {
    assertSessionExists,
    streamReply: streamSessionAssistantReply
  }
) {
  return async function POST(
    request: Request,
    context: SessionMessagesStreamRouteContext
  ): Promise<Response> {
    const sessionId = await resolveSessionId(context);

    let body: SessionStreamBody;
    try {
      body = (await request.json()) as SessionStreamBody;
    } catch {
      return Response.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    const parsed = parseBody(body);
    if (!parsed) {
      return Response.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    try {
      await deps.assertSessionExists(sessionId);
    } catch (error) {
      const mapped = mapServiceError(error);
      if (mapped) {
        return Response.json({ error: mapped.code, message: mapped.message }, { status: statusFromRouteError(mapped) });
      }
      return Response.json({ error: "SESSION_STREAM_PRECHECK_FAILED" }, { status: 500 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of deps.streamReply({
            sessionId,
            role: parsed.role,
            content: parsed.content,
            metaJson: parsed.metaJson,
            signal: request.signal
          })) {
            if (event.type === "ack") {
              controller.enqueue(encoder.encode(toSse("ack", { userMessage: event.userMessage })));
              continue;
            }

            if (event.type === "delta") {
              controller.enqueue(encoder.encode(toSse("delta", { text: event.text })));
              continue;
            }

            if (event.type === "done") {
              controller.enqueue(
                encoder.encode(toSse("done", { assistantMessage: event.assistantMessage }))
              );
              continue;
            }

            controller.enqueue(
              encoder.encode(
                toSse("error", {
                  code: event.code,
                  message: event.message
                })
              )
            );
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "stream failed";
          controller.enqueue(
            encoder.encode(
              toSse("error", {
                code: "SESSION_STREAM_FAILED",
                message
              })
            )
          );
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive"
      }
    });
  };
}

export const POST = createSessionMessagesStreamPostHandler();

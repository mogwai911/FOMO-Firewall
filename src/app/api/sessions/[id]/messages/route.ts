import { appendSessionMessage, SessionServiceError } from "@/lib/services/session-v2-service";

interface SessionMessagesRouteContext {
  params:
    | Promise<{
        id: string;
      }>
    | {
        id: string;
      };
}

interface SessionMessagesRouteDeps {
  appendSessionMessage: typeof appendSessionMessage;
}

interface SessionMessageBody {
  role?: unknown;
  content?: unknown;
  metaJson?: unknown;
}

async function resolveSessionId(context: SessionMessagesRouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

function parseRole(value: unknown): "user" | "assistant" | "tool" | null {
  if (value === "user" || value === "assistant" || value === "tool") {
    return value;
  }
  return null;
}

function parseContent(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  return value.trim().length > 0 ? value : null;
}

export function createSessionMessagesPostHandler(
  deps: SessionMessagesRouteDeps = {
    appendSessionMessage
  }
) {
  return async function POST(
    request: Request,
    context: SessionMessagesRouteContext
  ): Promise<Response> {
    const sessionId = await resolveSessionId(context);

    let body: SessionMessageBody;
    try {
      body = (await request.json()) as SessionMessageBody;
    } catch {
      return Response.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    const role = parseRole(body.role);
    const content = parseContent(body.content);
    if (!role) {
      return Response.json({ error: "INVALID_ROLE" }, { status: 400 });
    }
    if (!content) {
      return Response.json({ error: "CONTENT_REQUIRED" }, { status: 400 });
    }

    try {
      const message = await deps.appendSessionMessage({
        sessionId,
        role,
        content,
        metaJson: body.metaJson
      });
      return Response.json({ message });
    } catch (error) {
      if (error instanceof SessionServiceError) {
        const status = error.code === "SESSION_NOT_FOUND" ? 404 : 400;
        return Response.json({ error: error.code, message: error.message }, { status });
      }
      return Response.json({ error: "SESSION_MESSAGE_FAILED" }, { status: 500 });
    }
  };
}

export const POST = createSessionMessagesPostHandler();

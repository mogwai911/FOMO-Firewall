import {
  isSessionStatusV2,
  SessionReadServiceError,
  updateSessionLifecycleStatus
} from "@/lib/services/session-read-service";

interface SessionStatusRouteContext {
  params:
    | Promise<{
        id: string;
      }>
    | {
        id: string;
      };
}

interface SessionStatusRouteDeps {
  setStatus: typeof updateSessionLifecycleStatus;
}

interface SessionStatusBody {
  status?: unknown;
}

async function resolveSessionId(context: SessionStatusRouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export function createSessionStatusPostHandler(
  deps: SessionStatusRouteDeps = {
    setStatus: updateSessionLifecycleStatus
  }
) {
  return async function POST(
    request: Request,
    context: SessionStatusRouteContext
  ): Promise<Response> {
    const sessionId = await resolveSessionId(context);

    let body: SessionStatusBody;
    try {
      body = (await request.json()) as SessionStatusBody;
    } catch {
      return Response.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    if (!isSessionStatusV2(body.status)) {
      return Response.json({ error: "INVALID_SESSION_STATUS" }, { status: 400 });
    }

    try {
      const session = await deps.setStatus({
        sessionId,
        status: body.status
      });
      return Response.json({ session });
    } catch (error) {
      if (error instanceof SessionReadServiceError) {
        const status = error.code === "SESSION_NOT_FOUND" ? 404 : 400;
        return Response.json({ error: error.code, message: error.message }, { status });
      }
      return Response.json({ error: "SESSION_STATUS_UPDATE_FAILED" }, { status: 500 });
    }
  };
}

export const POST = createSessionStatusPostHandler();

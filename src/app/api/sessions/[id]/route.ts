import {
  deleteSessionById,
  getSessionDetail,
  SessionReadServiceError
} from "@/lib/services/session-read-service";

interface SessionDetailRouteContext {
  params:
    | Promise<{
        id: string;
      }>
    | {
        id: string;
      };
}

interface SessionDetailRouteDeps {
  getSession: typeof getSessionDetail;
  deleteSession: typeof deleteSessionById;
}

async function resolveSessionId(context: SessionDetailRouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export function createSessionGetHandler(
  deps: SessionDetailRouteDeps = {
    getSession: getSessionDetail,
    deleteSession: deleteSessionById
  }
) {
  return async function GET(_request: Request, context: SessionDetailRouteContext): Promise<Response> {
    const sessionId = await resolveSessionId(context);

    try {
      const session = await deps.getSession(sessionId);
      return Response.json({ session });
    } catch (error) {
      if (error instanceof SessionReadServiceError) {
        const status = error.code === "SESSION_NOT_FOUND" ? 404 : 400;
        return Response.json({ error: error.code, message: error.message }, { status });
      }
      return Response.json({ error: "SESSION_READ_FAILED" }, { status: 500 });
    }
  };
}

export function createSessionDeleteHandler(
  deps: SessionDetailRouteDeps = {
    getSession: getSessionDetail,
    deleteSession: deleteSessionById
  }
) {
  return async function DELETE(
    _request: Request,
    context: SessionDetailRouteContext
  ): Promise<Response> {
    const sessionId = await resolveSessionId(context);

    try {
      const deleted = await deps.deleteSession(sessionId);
      return Response.json({ deleted });
    } catch (error) {
      if (error instanceof SessionReadServiceError) {
        const status = error.code === "SESSION_NOT_FOUND" ? 404 : 400;
        return Response.json({ error: error.code, message: error.message }, { status });
      }
      return Response.json({ error: "SESSION_DELETE_FAILED" }, { status: 500 });
    }
  };
}

export const GET = createSessionGetHandler();
export const DELETE = createSessionDeleteHandler();

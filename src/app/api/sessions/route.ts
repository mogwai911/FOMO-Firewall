import { createOrResumeSession, SessionServiceError } from "@/lib/services/session-v2-service";
import {
  isSessionStatusV2,
  listRecentSessions
} from "@/lib/services/session-read-service";

interface SessionsRouteDeps {
  createOrResumeSession: typeof createOrResumeSession;
  listSessions: typeof listRecentSessions;
}

interface SessionsBody {
  signalId?: unknown;
}

function parseSignalId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function createSessionsPostHandler(
  deps: SessionsRouteDeps = {
    createOrResumeSession,
    listSessions: listRecentSessions
  }
) {
  return async function POST(request: Request): Promise<Response> {
    let body: SessionsBody;
    try {
      body = (await request.json()) as SessionsBody;
    } catch {
      return Response.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    const signalId = parseSignalId(body.signalId);
    if (!signalId) {
      return Response.json({ error: "SIGNAL_ID_REQUIRED" }, { status: 400 });
    }

    try {
      const session = await deps.createOrResumeSession({ signalId });
      return Response.json({ session });
    } catch (error) {
      if (error instanceof SessionServiceError) {
        const status = error.code === "SIGNAL_NOT_FOUND" ? 404 : 400;
        return Response.json({ error: error.code, message: error.message }, { status });
      }
      return Response.json({ error: "SESSION_CREATE_FAILED" }, { status: 500 });
    }
  };
}

function parseLimit(value: string | null): number | null {
  if (!value) {
    return 20;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  const int = Math.floor(num);
  if (int < 1 || int > 100) {
    return null;
  }
  return int;
}

function parseStatuses(value: string | null): Array<"ACTIVE" | "PAUSED" | "CLOSED"> | null {
  if (!value) {
    return ["ACTIVE", "PAUSED"];
  }
  const tokens = value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    return ["ACTIVE", "PAUSED"];
  }
  if (!tokens.every((token) => isSessionStatusV2(token))) {
    return null;
  }
  return tokens as Array<"ACTIVE" | "PAUSED" | "CLOSED">;
}

export function createSessionsGetHandler(
  deps: SessionsRouteDeps = {
    createOrResumeSession,
    listSessions: listRecentSessions
  }
) {
  return async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit"));
    if (limit === null) {
      return Response.json({ error: "INVALID_LIMIT" }, { status: 400 });
    }
    const statuses = parseStatuses(url.searchParams.get("status"));
    if (!statuses) {
      return Response.json({ error: "INVALID_STATUS" }, { status: 400 });
    }

    try {
      const sessions = await deps.listSessions({
        limit,
        statuses
      });
      return Response.json({ sessions });
    } catch {
      return Response.json({ error: "SESSIONS_LIST_FAILED" }, { status: 500 });
    }
  };
}

export const GET = createSessionsGetHandler();
export const POST = createSessionsPostHandler();

import {
  type DigestResetMode,
  DigestManualRefreshServiceError,
  manualRefreshDigest
} from "@/lib/services/digest-manual-refresh-service";
import { isValidRoleV2 } from "@/lib/services/triage-v2-service";
import { isValidTimeZone } from "@/lib/time/date-window";

interface DigestManualRefreshRouteContext {
  params:
    | Promise<{
        date: string;
      }>
    | {
        date: string;
      };
}

interface DigestManualRefreshRouteDeps {
  manualRefresh: typeof manualRefreshDigest;
}

interface DigestManualRefreshBody {
  overwrite?: unknown;
  resetMode?: unknown;
  role?: unknown;
  timezone?: unknown;
  windowDays?: unknown;
  limit?: unknown;
}

async function resolveDateKey(context: DigestManualRefreshRouteContext): Promise<string> {
  const params = await context.params;
  return params.date;
}

function parseResetMode(value: unknown): DigestResetMode | null {
  if (value === undefined) {
    return "PRESERVE_DISPOSITIONS";
  }
  if (value === "PRESERVE_DISPOSITIONS" || value === "RESET_DISPOSITIONS") {
    return value;
  }
  return null;
}

function parseTimezone(value: unknown): string | undefined | null {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "UTC";
  }
  if (!isValidTimeZone(trimmed)) {
    return null;
  }
  return trimmed;
}

function parseWindowDays(value: unknown): 1 | 3 | 7 | undefined | null {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value);
  if (rounded === 1 || rounded === 3 || rounded === 7) {
    return rounded;
  }
  return null;
}

function parseLimit(value: unknown): number | undefined | null {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value);
  if (rounded < 1 || rounded > 200) {
    return null;
  }
  return rounded;
}

export function createDigestManualRefreshPostHandler(
  deps: DigestManualRefreshRouteDeps = {
    manualRefresh: manualRefreshDigest
  }
) {
  return async function POST(
    request: Request,
    context: DigestManualRefreshRouteContext
  ): Promise<Response> {
    const dateKey = await resolveDateKey(context);

    let body: DigestManualRefreshBody = {};
    try {
      body = (await request.json()) as DigestManualRefreshBody;
    } catch {
      body = {};
    }

    if (body.overwrite !== undefined && typeof body.overwrite !== "boolean") {
      return Response.json({ error: "INVALID_OVERWRITE" }, { status: 400 });
    }

    const resetMode = parseResetMode(body.resetMode);
    if (!resetMode) {
      return Response.json({ error: "INVALID_RESET_MODE" }, { status: 400 });
    }
    const timezone = parseTimezone(body.timezone);
    if (timezone === null) {
      return Response.json({ error: "INVALID_TIMEZONE" }, { status: 400 });
    }
    const windowDays = parseWindowDays(body.windowDays);
    if (windowDays === null) {
      return Response.json({ error: "INVALID_WINDOW_DAYS" }, { status: 400 });
    }
    const limit = parseLimit(body.limit);
    if (limit === null) {
      return Response.json({ error: "INVALID_LIMIT" }, { status: 400 });
    }

    if (body.role !== undefined && !isValidRoleV2(body.role)) {
      return Response.json({ error: "INVALID_ROLE" }, { status: 400 });
    }

    try {
      const payload = await deps.manualRefresh({
        dateKey,
        overwrite: body.overwrite,
        resetMode,
        role: body.role as "PM" | "ENG" | "RES" | undefined,
        timezone,
        windowDays,
        limit
      });
      return Response.json(payload);
    } catch (error) {
      if (error instanceof DigestManualRefreshServiceError) {
        const status = error.code === "DIGEST_ALREADY_EXISTS" ? 409 : 400;
        return Response.json({ error: error.code, message: error.message }, { status });
      }
      return Response.json({ error: "DIGEST_MANUAL_REFRESH_FAILED" }, { status: 500 });
    }
  };
}

export const POST = createDigestManualRefreshPostHandler();

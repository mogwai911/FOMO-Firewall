import { DigestServiceError, generateDigestForDate } from "@/lib/services/digest-service";
import { isValidRoleV2 } from "@/lib/services/triage-v2-service";
import { isValidTimeZone } from "@/lib/time/date-window";

interface DigestRouteContext {
  params:
    | Promise<{
        date: string;
      }>
    | {
        date: string;
      };
}

interface DigestRouteDeps {
  generateDigest: typeof generateDigestForDate;
}

interface DigestBody {
  limit?: unknown;
  role?: unknown;
  timezone?: unknown;
  windowDays?: unknown;
}

async function resolveDateKey(context: DigestRouteContext): Promise<string> {
  const params = await context.params;
  return params.date;
}

function parseLimit(value: unknown): number | undefined {
  if (typeof value !== "number") {
    return undefined;
  }
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return Math.round(value);
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

export function createDigestGeneratePostHandler(
  deps: DigestRouteDeps = {
    generateDigest: generateDigestForDate
  }
) {
  return async function POST(request: Request, context: DigestRouteContext): Promise<Response> {
    const dateKey = await resolveDateKey(context);

    let body: DigestBody = {};
    try {
      body = (await request.json()) as DigestBody;
    } catch {
      body = {};
    }

    if (body.role !== undefined && !isValidRoleV2(body.role)) {
      return Response.json({ error: "INVALID_ROLE" }, { status: 400 });
    }
    const timezone = parseTimezone(body.timezone);
    if (timezone === null) {
      return Response.json({ error: "INVALID_TIMEZONE" }, { status: 400 });
    }
    const windowDays = parseWindowDays(body.windowDays);
    if (windowDays === null) {
      return Response.json({ error: "INVALID_WINDOW_DAYS" }, { status: 400 });
    }

    try {
      const out = await deps.generateDigest({
        dateKey,
        limit: parseLimit(body.limit),
        role: body.role as "PM" | "ENG" | "RES" | undefined,
        ...(timezone ? { timezone } : {}),
        ...(windowDays ? { windowDays } : {})
      });
      return Response.json(out);
    } catch (error) {
      if (error instanceof DigestServiceError) {
        return Response.json({ error: error.code, message: error.message }, { status: 400 });
      }
      return Response.json({ error: "DIGEST_GENERATE_FAILED" }, { status: 500 });
    }
  };
}

export const POST = createDigestGeneratePostHandler();

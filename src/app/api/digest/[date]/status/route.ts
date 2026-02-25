import {
  DigestManualRefreshServiceError,
  getDigestStatus
} from "@/lib/services/digest-manual-refresh-service";

interface DigestStatusRouteContext {
  params:
    | Promise<{
        date: string;
      }>
    | {
        date: string;
      };
}

interface DigestStatusRouteDeps {
  getStatus: typeof getDigestStatus;
}

async function resolveDateKey(context: DigestStatusRouteContext): Promise<string> {
  const params = await context.params;
  return params.date;
}

function parseWindowDays(value: string | null): 1 | 3 | 7 | undefined | null {
  if (value === null || value.trim() === "") {
    return undefined;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const rounded = Math.round(numeric);
  if (rounded === 1 || rounded === 3 || rounded === 7) {
    return rounded;
  }
  return null;
}

export function createDigestStatusGetHandler(
  deps: DigestStatusRouteDeps = {
    getStatus: getDigestStatus
  }
) {
  return async function GET(request: Request, context: DigestStatusRouteContext): Promise<Response> {
    const dateKey = await resolveDateKey(context);
    const url = new URL(request.url);
    const windowDays = parseWindowDays(url.searchParams.get("windowDays"));
    if (windowDays === null) {
      return Response.json({ error: "INVALID_WINDOW_DAYS" }, { status: 400 });
    }
    try {
      const status = await deps.getStatus({
        dateKey,
        ...(windowDays ? { windowDays } : {})
      });
      return Response.json({ status });
    } catch (error) {
      if (error instanceof DigestManualRefreshServiceError) {
        return Response.json({ error: error.code, message: error.message }, { status: 400 });
      }
      return Response.json({ error: "DIGEST_STATUS_FAILED" }, { status: 500 });
    }
  };
}

export const GET = createDigestStatusGetHandler();

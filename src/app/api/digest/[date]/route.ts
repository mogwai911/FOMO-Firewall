import { DigestViewServiceError, getDigestView } from "@/lib/services/digest-view-service";

interface DigestViewRouteContext {
  params:
    | Promise<{
        date: string;
      }>
    | {
        date: string;
      };
}

interface DigestViewRouteDeps {
  getDigestView: typeof getDigestView;
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

async function resolveDateKey(context: DigestViewRouteContext): Promise<string> {
  const params = await context.params;
  return params.date;
}

export function createDigestViewGetHandler(
  deps: DigestViewRouteDeps = {
    getDigestView
  }
) {
  return async function GET(request: Request, context: DigestViewRouteContext): Promise<Response> {
    const dateKey = await resolveDateKey(context);
    const url = new URL(request.url);
    const windowDays = parseWindowDays(url.searchParams.get("windowDays"));
    if (windowDays === null) {
      return Response.json({ error: "INVALID_WINDOW_DAYS" }, { status: 400 });
    }
    try {
      const view = await deps.getDigestView({
        dateKey,
        ...(windowDays ? { windowDays } : {})
      });
      return Response.json(view);
    } catch (error) {
      if (error instanceof DigestViewServiceError) {
        return Response.json({ error: error.code, message: error.message }, { status: 400 });
      }
      return Response.json({ error: "DIGEST_VIEW_FAILED" }, { status: 500 });
    }
  };
}

export const GET = createDigestViewGetHandler();

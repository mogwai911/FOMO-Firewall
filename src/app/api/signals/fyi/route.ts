import { listFyiSignals, SignalFyiServiceError } from "@/lib/services/fyi-service";

interface FyiRouteDeps {
  listFyiSignals: typeof listFyiSignals;
}

function parseLimit(url: URL): number | undefined {
  const raw = url.searchParams.get("limit");
  if (!raw) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return NaN;
  }
  return Math.round(value);
}

export function createFyiSignalsGetHandler(
  deps: FyiRouteDeps = {
    listFyiSignals
  }
) {
  return async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const limit = parseLimit(url);
    if (limit !== undefined && (!Number.isFinite(limit) || limit < 1 || limit > 100)) {
      return Response.json({ error: "INVALID_LIMIT" }, { status: 400 });
    }

    try {
      const signals = await deps.listFyiSignals({
        limit
      });
      return Response.json({ signals });
    } catch (error) {
      if (error instanceof SignalFyiServiceError) {
        return Response.json({ error: error.code, message: error.message }, { status: 400 });
      }
      return Response.json({ error: "LATER_LIST_FAILED" }, { status: 500 });
    }
  };
}

export const GET = createFyiSignalsGetHandler();

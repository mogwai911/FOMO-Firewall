import { listInsightCards } from "@/lib/services/job-service";

interface InsightCardsRouteDeps {
  listInsightCards: typeof listInsightCards;
}

function parseLimit(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function createInsightCardsGetHandler(
  deps: InsightCardsRouteDeps = {
    listInsightCards
  }
) {
  return async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId") ?? undefined;
    const limit = parseLimit(url.searchParams.get("limit"));

    const cards = await deps.listInsightCards({
      sessionId,
      limit
    });
    return Response.json({ cards });
  };
}

export const GET = createInsightCardsGetHandler();

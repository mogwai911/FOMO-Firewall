import { listEvidencePacks } from "@/lib/services/job-service";

interface EvidencePacksRouteDeps {
  listEvidencePacks: typeof listEvidencePacks;
}

function parseLimit(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function createEvidencePacksGetHandler(
  deps: EvidencePacksRouteDeps = {
    listEvidencePacks
  }
) {
  return async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId") ?? undefined;
    const limit = parseLimit(url.searchParams.get("limit"));

    const packs = await deps.listEvidencePacks({
      sessionId,
      limit
    });
    return Response.json({ packs });
  };
}

export const GET = createEvidencePacksGetHandler();

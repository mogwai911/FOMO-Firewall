import { EvidenceServiceError, getEvidencePackDetail } from "@/lib/services/evidence-service";

interface EvidencePackRouteContext {
  params:
    | Promise<{
        id: string;
      }>
    | {
        id: string;
      };
}

interface EvidencePackRouteDeps {
  getPack: typeof getEvidencePackDetail;
}

async function resolveEvidenceId(context: EvidencePackRouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export function createEvidencePackGetHandler(
  deps: EvidencePackRouteDeps = {
    getPack: getEvidencePackDetail
  }
) {
  return async function GET(_request: Request, context: EvidencePackRouteContext): Promise<Response> {
    const evidenceId = await resolveEvidenceId(context);

    try {
      const pack = await deps.getPack(evidenceId);
      return Response.json({ pack });
    } catch (error) {
      if (error instanceof EvidenceServiceError) {
        return Response.json({ error: error.code, message: error.message }, { status: 404 });
      }
      return Response.json({ error: "EVIDENCE_PACK_READ_FAILED" }, { status: 500 });
    }
  };
}

export const GET = createEvidencePackGetHandler();

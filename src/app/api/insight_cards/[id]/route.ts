import { deleteInsightCardById, JobServiceError } from "@/lib/services/job-service";

interface InsightCardRouteContext {
  params:
    | Promise<{
        id: string;
      }>
    | {
        id: string;
      };
}

interface InsightCardRouteDeps {
  deleteInsightCardById: typeof deleteInsightCardById;
}

async function resolveInsightCardId(context: InsightCardRouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export function createInsightCardDeleteHandler(
  deps: InsightCardRouteDeps = {
    deleteInsightCardById
  }
) {
  return async function DELETE(
    _request: Request,
    context: InsightCardRouteContext
  ): Promise<Response> {
    const insightCardId = await resolveInsightCardId(context);
    try {
      const deleted = await deps.deleteInsightCardById(insightCardId);
      return Response.json({ deleted });
    } catch (error) {
      if (error instanceof JobServiceError) {
        const status = error.code === "INSIGHT_CARD_NOT_FOUND" ? 404 : 400;
        return Response.json({ error: error.code, message: error.message }, { status });
      }
      return Response.json({ error: "INSIGHT_CARD_DELETE_FAILED" }, { status: 500 });
    }
  };
}

export const DELETE = createInsightCardDeleteHandler();

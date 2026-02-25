import { deleteSource, SourcesServiceError } from "@/lib/services/sources-service";

interface SourceRouteContext {
  params:
    | Promise<{
        id: string;
      }>
    | {
        id: string;
      };
}

interface SourceRouteDeps {
  deleteSource: typeof deleteSource;
}

async function resolveSourceId(context: SourceRouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export function createSourceDeleteHandler(
  deps: SourceRouteDeps = {
    deleteSource
  }
) {
  return async function DELETE(_: Request, context: SourceRouteContext): Promise<Response> {
    const sourceId = await resolveSourceId(context);
    try {
      const source = await deps.deleteSource(sourceId);
      return Response.json({ source });
    } catch (error) {
      if (error instanceof SourcesServiceError) {
        const status = error.code === "SOURCE_NOT_FOUND" ? 404 : 400;
        return Response.json({ error: error.code, message: error.message }, { status });
      }
      return Response.json({ error: "SOURCE_DELETE_FAILED" }, { status: 500 });
    }
  };
}

export const DELETE = createSourceDeleteHandler();

import { SourcesServiceError, toggleSource } from "@/lib/services/sources-service";

interface ToggleRouteContext {
  params:
    | Promise<{
        id: string;
      }>
    | {
        id: string;
      };
}

interface ToggleRouteDeps {
  toggleSource: typeof toggleSource;
}

interface ToggleBody {
  enabled?: unknown;
}

async function resolveSourceId(context: ToggleRouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export function createSourceTogglePostHandler(
  deps: ToggleRouteDeps = {
    toggleSource
  }
) {
  return async function POST(request: Request, context: ToggleRouteContext): Promise<Response> {
    const sourceId = await resolveSourceId(context);

    let body: ToggleBody = {};
    try {
      body = (await request.json()) as ToggleBody;
    } catch {
      body = {};
    }

    if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
      return Response.json({ error: "INVALID_ENABLED_VALUE" }, { status: 400 });
    }

    try {
      const source = await deps.toggleSource(sourceId, body.enabled as boolean | undefined);
      return Response.json({ source });
    } catch (error) {
      if (error instanceof SourcesServiceError) {
        const status = error.code === "SOURCE_NOT_FOUND" ? 404 : 400;
        return Response.json({ error: error.code, message: error.message }, { status });
      }

      return Response.json({ error: "SOURCE_TOGGLE_FAILED" }, { status: 500 });
    }
  };
}

export const POST = createSourceTogglePostHandler();

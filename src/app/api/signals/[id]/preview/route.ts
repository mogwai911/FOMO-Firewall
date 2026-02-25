import {
  buildSignalPreview,
  SignalPreviewServiceError
} from "@/lib/services/signal-preview-service";

interface SignalPreviewRouteContext {
  params:
    | Promise<{
        id: string;
      }>
    | {
        id: string;
      };
}

interface SignalPreviewRouteDeps {
  buildPreview: typeof buildSignalPreview;
}

async function resolveSignalId(context: SignalPreviewRouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export function createSignalPreviewGetHandler(
  deps: SignalPreviewRouteDeps = {
    buildPreview: buildSignalPreview
  }
) {
  return async function GET(
    _request: Request,
    context: SignalPreviewRouteContext
  ): Promise<Response> {
    const signalId = await resolveSignalId(context);
    try {
      const preview = await deps.buildPreview({
        signalId
      });
      return Response.json({
        preview
      });
    } catch (error) {
      if (error instanceof SignalPreviewServiceError) {
        const status = error.code === "SIGNAL_NOT_FOUND" ? 404 : 400;
        return Response.json({ error: error.code, message: error.message }, { status });
      }
      return Response.json({ error: "SIGNAL_PREVIEW_FAILED" }, { status: 500 });
    }
  };
}

export const GET = createSignalPreviewGetHandler();

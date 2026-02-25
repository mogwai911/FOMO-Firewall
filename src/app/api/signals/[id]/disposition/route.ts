import {
  DispositionServiceError,
  isDispositionLabel,
  setSignalDisposition
} from "@/lib/services/disposition-service";

interface SignalDispositionRouteContext {
  params:
    | Promise<{
        id: string;
      }>
    | {
        id: string;
      };
}

interface SignalDispositionRouteDeps {
  setDisposition: typeof setSignalDisposition;
}

interface SignalDispositionBody {
  label?: unknown;
  isOverride?: unknown;
}

async function resolveSignalId(context: SignalDispositionRouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export function createSignalDispositionPostHandler(
  deps: SignalDispositionRouteDeps = {
    setDisposition: setSignalDisposition
  }
) {
  return async function POST(
    request: Request,
    context: SignalDispositionRouteContext
  ): Promise<Response> {
    const signalId = await resolveSignalId(context);
    let body: SignalDispositionBody;

    try {
      body = (await request.json()) as SignalDispositionBody;
    } catch {
      return Response.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    if (!isDispositionLabel(body.label)) {
      return Response.json({ error: "INVALID_DISPOSITION_LABEL" }, { status: 400 });
    }

    try {
      const disposition = await deps.setDisposition({
        signalId,
        label: body.label,
        isOverride: body.isOverride === undefined ? true : Boolean(body.isOverride)
      });
      return Response.json({ disposition });
    } catch (error) {
      if (error instanceof DispositionServiceError) {
        const status = error.code === "SIGNAL_NOT_FOUND" ? 404 : 400;
        return Response.json({ error: error.code, message: error.message }, { status });
      }
      return Response.json({ error: "SIGNAL_DISPOSITION_FAILED" }, { status: 500 });
    }
  };
}

export const POST = createSignalDispositionPostHandler();

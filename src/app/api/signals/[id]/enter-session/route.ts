import {
  enterSessionFromSignal,
  SignalEnterSessionServiceError
} from "@/lib/services/signal-enter-session-service";

interface SignalEnterSessionRouteContext {
  params:
    | Promise<{
        id: string;
      }>
    | {
        id: string;
      };
}

interface SignalEnterSessionRouteDeps {
  enterSession: typeof enterSessionFromSignal;
}

async function resolveSignalId(context: SignalEnterSessionRouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export function createSignalEnterSessionPostHandler(
  deps: SignalEnterSessionRouteDeps = {
    enterSession: enterSessionFromSignal
  }
) {
  return async function POST(
    _: Request,
    context: SignalEnterSessionRouteContext
  ): Promise<Response> {
    const signalId = await resolveSignalId(context);
    try {
      const result = await deps.enterSession({
        signalId
      });
      return Response.json(result);
    } catch (error) {
      if (error instanceof SignalEnterSessionServiceError) {
        const status = error.code === "SIGNAL_NOT_FOUND" ? 404 : 400;
        return Response.json({ error: error.code, message: error.message }, { status });
      }
      return Response.json({ error: "SIGNAL_ENTER_SESSION_FAILED" }, { status: 500 });
    }
  };
}

export const POST = createSignalEnterSessionPostHandler();

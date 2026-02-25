import {
  generateTriageForSignal,
  isValidRoleV2,
  SignalTriageServiceError
} from "@/lib/services/triage-v2-service";

interface SignalTriageRouteContext {
  params:
    | Promise<{
        id: string;
      }>
    | {
        id: string;
      };
}

interface SignalTriageRouteDeps {
  generateTriage: typeof generateTriageForSignal;
}

interface SignalTriageBody {
  role?: unknown;
}

async function resolveSignalId(context: SignalTriageRouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export function createSignalTriagePostHandler(
  deps: SignalTriageRouteDeps = {
    generateTriage: generateTriageForSignal
  }
) {
  return async function POST(request: Request, context: SignalTriageRouteContext): Promise<Response> {
    const signalId = await resolveSignalId(context);
    let body: SignalTriageBody = {};
    try {
      body = (await request.json()) as SignalTriageBody;
    } catch {
      body = {};
    }

    const role = body.role ?? "ENG";
    if (!isValidRoleV2(role)) {
      return Response.json({ error: "INVALID_ROLE" }, { status: 400 });
    }

    try {
      const out = await deps.generateTriage({
        signalId,
        role
      });
      return Response.json(out);
    } catch (error) {
      if (error instanceof SignalTriageServiceError) {
        const status = error.code === "SIGNAL_NOT_FOUND" ? 404 : 400;
        return Response.json({ error: error.code, message: error.message }, { status });
      }
      return Response.json({ error: "TRIAGE_GENERATE_FAILED" }, { status: 500 });
    }
  };
}

export const POST = createSignalTriagePostHandler();

import { isEventTypeV2, recordEventV2 } from "@/lib/services/eventlog-v2-service";

interface SignalEventsRouteContext {
  params:
    | Promise<{
        id: string;
      }>
    | {
        id: string;
      };
}

interface SignalEventsRouteDeps {
  recordEvent: typeof recordEventV2;
}

interface SignalEventsBody {
  type?: unknown;
  payloadJson?: unknown;
}

async function resolveSignalId(context: SignalEventsRouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export function createSignalEventsPostHandler(
  deps: SignalEventsRouteDeps = {
    recordEvent: recordEventV2
  }
) {
  return async function POST(request: Request, context: SignalEventsRouteContext): Promise<Response> {
    const signalId = await resolveSignalId(context);
    let body: SignalEventsBody;

    try {
      body = (await request.json()) as SignalEventsBody;
    } catch {
      return Response.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    if (!isEventTypeV2(body.type)) {
      return Response.json({ error: "INVALID_EVENT_TYPE" }, { status: 400 });
    }

    try {
      const event = await deps.recordEvent({
        type: body.type,
        signalId,
        payloadJson: body.payloadJson as any
      });
      return Response.json({ event });
    } catch {
      return Response.json({ error: "SIGNAL_EVENT_CREATE_FAILED" }, { status: 500 });
    }
  };
}

export const POST = createSignalEventsPostHandler();

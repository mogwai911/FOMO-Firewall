import { runScheduledTick } from "@/lib/services/scheduler-service";

interface ScheduleTickRouteDeps {
  runTick: typeof runScheduledTick;
}

export function createScheduleTickPostHandler(
  deps: ScheduleTickRouteDeps = {
    runTick: runScheduledTick
  }
) {
  return async function POST(): Promise<Response> {
    try {
      const result = await deps.runTick({});
      return Response.json(result);
    } catch {
      return Response.json({ error: "SCHEDULE_TICK_FAILED" }, { status: 500 });
    }
  };
}

export const POST = createScheduleTickPostHandler();

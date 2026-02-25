import { enqueueJob, isValidJobType, JobServiceError } from "@/lib/services/job-service";
import { dispatchJobToBackground } from "@/lib/services/job-queue";
import { processJobById } from "@/lib/services/job-worker";

interface SessionJobsRouteContext {
  params:
    | Promise<{
        id: string;
      }>
    | {
        id: string;
      };
}

interface SessionJobsRouteDeps {
  enqueueJob: typeof enqueueJob;
  dispatchJob: (jobId: string) => void;
  runJob: typeof processJobById;
}

interface SessionJobsBody {
  type?: unknown;
  runNow?: unknown;
}

async function resolveSessionId(context: SessionJobsRouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export function createSessionJobsPostHandler(
  deps: SessionJobsRouteDeps = {
    enqueueJob,
    dispatchJob: dispatchJobToBackground,
    runJob: processJobById
  }
) {
  return async function POST(request: Request, context: SessionJobsRouteContext): Promise<Response> {
    const sessionId = await resolveSessionId(context);

    let body: SessionJobsBody;
    try {
      body = (await request.json()) as SessionJobsBody;
    } catch {
      return Response.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    if (!isValidJobType(body.type)) {
      return Response.json({ error: "INVALID_JOB_TYPE" }, { status: 400 });
    }

    const runNow = body.runNow === true;

    try {
      const queuedJob = await deps.enqueueJob({
        sessionId,
        type: body.type
      });

      if (runNow) {
        const finished = await deps.runJob(queuedJob.id);
        return Response.json({
          job: {
            ...queuedJob,
            status: finished.status,
            resultRefJson: finished.resultRefJson,
            updatedAt: new Date().toISOString()
          }
        });
      }

      deps.dispatchJob(queuedJob.id);
      return Response.json({ job: queuedJob }, { status: 202 });
    } catch (error) {
      if (error instanceof JobServiceError) {
        const status = error.code === "SESSION_NOT_FOUND" ? 404 : 400;
        return Response.json({ error: error.code, message: error.message }, { status });
      }
      return Response.json({ error: "SESSION_JOB_FAILED" }, { status: 500 });
    }
  };
}

export const POST = createSessionJobsPostHandler();

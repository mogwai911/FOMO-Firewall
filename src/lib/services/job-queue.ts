import { processJobById } from "@/lib/services/job-worker";

interface JobQueueDeps {
  runJob: (jobId: string) => Promise<unknown>;
  schedule: (callback: () => void) => ReturnType<typeof setTimeout>;
}

export interface JobQueueDispatcher {
  dispatch: (jobId: string) => void;
}

export function createJobQueueDispatcher(
  deps: JobQueueDeps = {
    runJob: processJobById,
    schedule: (callback) => setTimeout(callback, 0)
  }
): JobQueueDispatcher {
  const inFlight = new Set<string>();

  return {
    dispatch: (jobId) => {
      if (!jobId || inFlight.has(jobId)) {
        return;
      }
      inFlight.add(jobId);
      deps.schedule(() => {
        void deps
          .runJob(jobId)
          .catch(() => undefined)
          .finally(() => {
            inFlight.delete(jobId);
          });
      });
    }
  };
}

const defaultDispatcher = createJobQueueDispatcher();

export function dispatchJobToBackground(jobId: string): void {
  defaultDispatcher.dispatch(jobId);
}

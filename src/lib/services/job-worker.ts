import { buildEvidencePack } from "@/lib/agent/deposit-agent";
import { createInsightCardWithProvider } from "@/lib/llm/insight-card-provider";
import { createAppStorage } from "@/lib/storage/app-storage";
import type { Prisma } from "@prisma/client";

interface WorkerJobRow {
  id: string;
  type: "INSIGHT_CARD" | "EVIDENCE_PACK";
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
  sessionId: string;
  session: {
    signalId: string;
    messages: Array<{
      role: "USER" | "ASSISTANT" | "TOOL";
      content: string;
    }>;
    signal: {
      title: string;
      summary: string | null;
    } | null;
  };
}

interface WorkerDeps {
  getJob: (jobId: string) => Promise<WorkerJobRow | null>;
  setJobRunning: (jobId: string) => Promise<void>;
  setJobDone: (
    jobId: string,
    resultRefJson: Prisma.InputJsonValue
  ) => Promise<{
    id: string;
    status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
    resultRefJson: unknown;
  }>;
  setJobFailed: (jobId: string, error: string) => Promise<void>;
  createInsightCards: (
    sessionId: string,
    signalId: string,
    messages: Array<{ role: "USER" | "ASSISTANT" | "TOOL"; content: string }>,
    signalTitle: string,
    signalSummary: string | null
  ) => Promise<string[]>;
  createEvidencePack: (
    sessionId: string,
    signalId: string,
    messages: Array<{ role: "USER" | "ASSISTANT" | "TOOL"; content: string }>,
    signalSummary: string | null
  ) => Promise<string>;
}

export class JobWorkerError extends Error {
  code: "JOB_NOT_FOUND";

  constructor(code: "JOB_NOT_FOUND", message: string) {
    super(message);
    this.code = code;
  }
}

function defaultDeps(): WorkerDeps {
  const storage = createAppStorage();
  return {
    getJob: (jobId) => storage.getJobForWorker(jobId),
    setJobRunning: (jobId) => storage.markJobRunning(jobId),
    setJobDone: (jobId, resultRefJson) => storage.markJobDone(jobId, resultRefJson),
    setJobFailed: (jobId, error) => storage.markJobFailed(jobId, error),
    createInsightCards: async (sessionId, signalId, messages, signalTitle, signalSummary) => {
      const card = await createInsightCardWithProvider({
        signalTitle,
        signalSummary,
        messages
      });

      return storage.saveInsightCards({
        sessionId,
        signalId,
        cards: [card]
      });
    },
    createEvidencePack: async (sessionId, signalId, messages, signalSummary) => {
      const pack = buildEvidencePack({
        signalSummary,
        messages,
        signalId,
        sessionId
      });

      return storage.saveEvidencePack({
        sessionId,
        signalId,
        pack
      });
    }
  };
}

export async function processJobById(
  jobId: string,
  deps: WorkerDeps = defaultDeps()
): Promise<{ id: string; status: "QUEUED" | "RUNNING" | "DONE" | "FAILED"; resultRefJson: unknown }> {
  const job = await deps.getJob(jobId);
  if (!job) {
    throw new JobWorkerError("JOB_NOT_FOUND", "job not found");
  }
  if (job.status === "DONE") {
    return {
      id: job.id,
      status: "DONE",
      resultRefJson: {}
    };
  }

  try {
    await deps.setJobRunning(job.id);
    if (job.type === "INSIGHT_CARD") {
      const insightCardIds = await deps.createInsightCards(
        job.sessionId,
        job.session.signalId,
        job.session.messages,
        job.session.signal?.title ?? "Untitled",
        job.session.signal?.summary ?? null
      );
      return deps.setJobDone(job.id, {
        insightCardIds
      } as Prisma.InputJsonValue);
    }

    const evidencePackId = await deps.createEvidencePack(
      job.sessionId,
      job.session.signalId,
      job.session.messages,
      job.session.signal?.summary ?? null
    );
    return deps.setJobDone(job.id, {
      evidencePackId
    } as Prisma.InputJsonValue);
  } catch (error) {
    await deps.setJobFailed(job.id, error instanceof Error ? error.message : "job failed");
    throw error;
  }
}

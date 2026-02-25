import { createAppStorage } from "@/lib/storage/app-storage";
import { recordEventV2 } from "@/lib/services/eventlog-v2-service";
import type { Prisma } from "@prisma/client";

export type JobTypeInput = "INSIGHT_CARD" | "EVIDENCE_PACK";

export interface JobView {
  id: string;
  sessionId: string;
  type: JobTypeInput;
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
  error: string | null;
  resultRefJson: unknown;
  createdAt: string;
  updatedAt: string;
}

interface JobRecord {
  id: string;
  sessionId: string;
  type: JobTypeInput;
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
  error: string | null;
  resultRefJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

interface JobServiceDeps {
  findSession: (sessionId: string) => Promise<{ id: string; signalId?: string } | null>;
  createJob: (input: { sessionId: string; type: JobTypeInput }) => Promise<JobRecord>;
  listInsightCards: (input: { sessionId?: string; limit: number }) => Promise<
    Array<{
      id: string;
      sessionId: string;
      signalId: string;
      insightJson: unknown;
      createdAt: Date;
    }>
  >;
  findInsightCardRef: (
    insightCardId: string
  ) => Promise<{
    id: string;
    sessionId: string;
    signalId: string;
  } | null>;
  deleteInsightCard: (insightCardId: string) => Promise<{ id: string }>;
  listEvidencePacks: (input: { sessionId?: string; limit: number }) => Promise<
    Array<{
      id: string;
      sessionId: string | null;
      signalId: string;
      packJson: unknown;
      createdAt: Date;
    }>
  >;
  recordEvent?: (input: {
    type: "JOB_ENQUEUED";
    signalId?: string;
    sessionId: string;
    jobId: string;
    payloadJson: {
      type: JobTypeInput;
    };
  }) => Promise<unknown>;
}

export class JobServiceError extends Error {
  code: "SESSION_NOT_FOUND" | "INVALID_JOB_TYPE" | "INSIGHT_CARD_NOT_FOUND";

  constructor(
    code: "SESSION_NOT_FOUND" | "INVALID_JOB_TYPE" | "INSIGHT_CARD_NOT_FOUND",
    message: string
  ) {
    super(message);
    this.code = code;
  }
}

const JOB_TYPES = new Set<JobTypeInput>(["INSIGHT_CARD", "EVIDENCE_PACK"]);

export function isValidJobType(value: unknown): value is JobTypeInput {
  return typeof value === "string" && JOB_TYPES.has(value as JobTypeInput);
}

function defaultDeps(): JobServiceDeps {
  const storage = createAppStorage();
  return {
    findSession: (sessionId) => storage.findSessionRef(sessionId),
    createJob: (input) => storage.createJob(input),
    listInsightCards: (input) => storage.listInsightCards(input),
    findInsightCardRef: (insightCardId) => storage.findInsightCardRef(insightCardId),
    deleteInsightCard: (insightCardId) => storage.deleteInsightCard(insightCardId),
    listEvidencePacks: (input) => storage.listEvidencePacks(input),
    recordEvent: (input) => recordEventV2(input)
  };
}

function toJobView(row: JobRecord): JobView {
  return {
    id: row.id,
    sessionId: row.sessionId,
    type: row.type,
    status: row.status,
    error: row.error,
    resultRefJson: row.resultRefJson,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function enqueueJob(
  input: { sessionId: string; type: JobTypeInput },
  deps: JobServiceDeps = defaultDeps()
): Promise<JobView> {
  if (!isValidJobType(input.type)) {
    throw new JobServiceError("INVALID_JOB_TYPE", "invalid job type");
  }

  const session = await deps.findSession(input.sessionId);
  if (!session) {
    throw new JobServiceError("SESSION_NOT_FOUND", "session not found");
  }

  const created = await deps.createJob(input);
  if (deps.recordEvent) {
    await deps.recordEvent({
      type: "JOB_ENQUEUED",
      signalId: session.signalId,
      sessionId: created.sessionId,
      jobId: created.id,
      payloadJson: {
        type: created.type
      }
    });
  }
  return toJobView(created);
}

function clampLimit(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return 50;
  }
  return Math.max(1, Math.min(200, value));
}

export async function listInsightCards(
  input: { sessionId?: string; limit?: number },
  deps: JobServiceDeps = defaultDeps()
): Promise<
  Array<{ id: string; sessionId: string; signalId: string; insightJson: unknown; createdAt: string }>
> {
  const rows = await deps.listInsightCards({
    sessionId: input.sessionId,
    limit: clampLimit(input.limit)
  });

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.sessionId,
    signalId: row.signalId,
    insightJson: row.insightJson,
    createdAt: row.createdAt.toISOString()
  }));
}

export async function listEvidencePacks(
  input: { sessionId?: string; limit?: number },
  deps: JobServiceDeps = defaultDeps()
): Promise<
  Array<{ id: string; sessionId: string | null; signalId: string; packJson: unknown; createdAt: string }>
> {
  const rows = await deps.listEvidencePacks({
    sessionId: input.sessionId,
    limit: clampLimit(input.limit)
  });

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.sessionId,
    signalId: row.signalId,
    packJson: row.packJson,
    createdAt: row.createdAt.toISOString()
  }));
}

export async function deleteInsightCardById(
  insightCardId: string,
  deps: JobServiceDeps = defaultDeps()
): Promise<{ id: string }> {
  const existing = await deps.findInsightCardRef(insightCardId);
  if (!existing) {
    throw new JobServiceError("INSIGHT_CARD_NOT_FOUND", "insight card not found");
  }
  return deps.deleteInsightCard(insightCardId);
}

export type UpdateJobPayload = Prisma.InputJsonValue;

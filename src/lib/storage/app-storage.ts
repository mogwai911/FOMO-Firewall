import { db } from "@/lib/db";
import type { InsightCardDraft, EvidencePackDraft } from "@/lib/agent/deposit-agent";
import type { RoleV2 } from "@/lib/agent/triage-agent";
import type { Prisma, PrismaClient } from "@prisma/client";

type SessionStatus = "ACTIVE" | "PAUSED" | "CLOSED";
type JobType = "INSIGHT_CARD" | "EVIDENCE_PACK";
type JobStatus = "QUEUED" | "RUNNING" | "DONE" | "FAILED";
type MessageRole = "USER" | "ASSISTANT" | "TOOL";

type AppDb = Pick<
  PrismaClient,
  "signal" | "signalTriage" | "session" | "sessionMessage" | "job" | "insightCard" | "evidencePack"
>;

export interface WorkerJobRecord {
  id: string;
  type: JobType;
  status: JobStatus;
  sessionId: string;
  session: {
    signalId: string;
    messages: Array<{
      role: MessageRole;
      content: string;
    }>;
    signal: {
      title: string;
      summary: string | null;
    } | null;
  };
}

export interface AppStorage {
  findSignalRef: (signalId: string) => Promise<{ id: string } | null>;
  findSignalForTriage: (
    signalId: string
  ) => Promise<{
    id: string;
    title: string;
    summary: string | null;
    source: { name: string | null };
  } | null>;
  createSignalTriage: (input: {
    signalId: string;
    role: RoleV2;
    triageJson: Prisma.InputJsonValue;
  }) => Promise<{
    id: string;
    triageJson: unknown;
  }>;
  findLatestResumableSessionBySignal: (signalId: string) => Promise<{
    id: string;
    signalId: string;
    status: SessionStatus;
    createdAt: Date;
    updatedAt: Date;
  } | null>;
  createSession: (input: { signalId: string; status?: SessionStatus }) => Promise<{
    id: string;
    signalId: string;
    status: SessionStatus;
    createdAt: Date;
    updatedAt: Date;
  }>;
  updateSessionStatus: (sessionId: string, status: SessionStatus) => Promise<{
    id: string;
    signalId: string;
    status: SessionStatus;
    createdAt: Date;
    updatedAt: Date;
  }>;
  findSessionRef: (sessionId: string) => Promise<{ id: string; signalId: string } | null>;
  createSessionMessage: (input: {
    sessionId: string;
    role: MessageRole;
    content: string;
    metaJson?: Prisma.InputJsonValue;
  }) => Promise<{
    id: string;
    sessionId: string;
    role: MessageRole;
    content: string;
    metaJson: unknown;
    createdAt: Date;
  }>;
  createJob: (input: { sessionId: string; type: JobType }) => Promise<{
    id: string;
    sessionId: string;
    type: JobType;
    status: JobStatus;
    error: string | null;
    resultRefJson: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>;
  listInsightCards: (input: { sessionId?: string; limit: number }) => Promise<
    Array<{
      id: string;
      sessionId: string;
      signalId: string;
      insightJson: unknown;
      createdAt: Date;
    }>
  >;
  findInsightCardRef: (insightCardId: string) => Promise<{
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
  getJobForWorker: (jobId: string) => Promise<WorkerJobRecord | null>;
  markJobRunning: (jobId: string) => Promise<void>;
  markJobDone: (
    jobId: string,
    resultRefJson: Prisma.InputJsonValue
  ) => Promise<{
    id: string;
    status: JobStatus;
    resultRefJson: unknown;
  }>;
  markJobFailed: (jobId: string, error: string) => Promise<void>;
  saveInsightCards: (input: {
    sessionId: string;
    signalId: string;
    cards: InsightCardDraft[];
  }) => Promise<string[]>;
  saveEvidencePack: (input: {
    sessionId: string;
    signalId: string;
    pack: EvidencePackDraft;
  }) => Promise<string>;
}

export function createAppStorage(database: AppDb = db): AppStorage {
  return {
    findSignalRef: (signalId) =>
      database.signal.findUnique({
        where: { id: signalId },
        select: { id: true }
      }),
    findSignalForTriage: (signalId) =>
      database.signal.findUnique({
        where: { id: signalId },
        select: {
          id: true,
          title: true,
          summary: true,
          source: {
            select: {
              name: true
            }
          }
        }
      }),
    createSignalTriage: (input) =>
      database.signalTriage.create({
        data: input,
        select: {
          id: true,
          triageJson: true
        }
      }),
    findLatestResumableSessionBySignal: (signalId) =>
      database.session.findFirst({
        where: {
          signalId,
          status: {
            in: ["ACTIVE", "PAUSED"]
          }
        },
        orderBy: {
          updatedAt: "desc"
        },
        select: {
          id: true,
          signalId: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      }),
    createSession: (input) =>
      database.session.create({
        data: {
          signalId: input.signalId,
          status: input.status ?? "ACTIVE"
        },
        select: {
          id: true,
          signalId: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      }),
    updateSessionStatus: (sessionId, status) =>
      database.session.update({
        where: { id: sessionId },
        data: { status },
        select: {
          id: true,
          signalId: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      }),
    findSessionRef: (sessionId) =>
      database.session.findUnique({
        where: { id: sessionId },
        select: { id: true, signalId: true }
      }),
    createSessionMessage: (input) =>
      database.sessionMessage.create({
        data: input,
        select: {
          id: true,
          sessionId: true,
          role: true,
          content: true,
          metaJson: true,
          createdAt: true
        }
      }),
    createJob: (input) =>
      database.job.create({
        data: input,
        select: {
          id: true,
          sessionId: true,
          type: true,
          status: true,
          error: true,
          resultRefJson: true,
          createdAt: true,
          updatedAt: true
        }
      }),
    listInsightCards: (input) =>
      database.insightCard.findMany({
        where: input.sessionId ? { sessionId: input.sessionId } : undefined,
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          sessionId: true,
          signalId: true,
          insightJson: true,
          createdAt: true
        }
      }),
    findInsightCardRef: (insightCardId) =>
      database.insightCard.findUnique({
        where: { id: insightCardId },
        select: {
          id: true,
          sessionId: true,
          signalId: true
        }
      }),
    deleteInsightCard: (insightCardId) =>
      database.insightCard.delete({
        where: { id: insightCardId },
        select: { id: true }
      }),
    listEvidencePacks: (input) =>
      database.evidencePack.findMany({
        where: input.sessionId ? { sessionId: input.sessionId } : undefined,
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          sessionId: true,
          signalId: true,
          packJson: true,
          createdAt: true
        }
      }),
    getJobForWorker: (jobId) =>
      database.job.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          type: true,
          status: true,
          sessionId: true,
          session: {
            select: {
              signalId: true,
              messages: {
                orderBy: { createdAt: "asc" },
                select: {
                  role: true,
                  content: true
                }
              },
              signal: {
                select: {
                  title: true,
                  summary: true
                }
              }
            }
          }
        }
      }),
    markJobRunning: async (jobId) => {
      await database.job.update({
        where: { id: jobId },
        data: { status: "RUNNING", error: null }
      });
    },
    markJobDone: (jobId, resultRefJson) =>
      database.job.update({
        where: { id: jobId },
        data: {
          status: "DONE",
          resultRefJson,
          error: null
        },
        select: {
          id: true,
          status: true,
          resultRefJson: true
        }
      }),
    markJobFailed: async (jobId, error) => {
      await database.job.update({
        where: { id: jobId },
        data: { status: "FAILED", error }
      });
    },
    saveInsightCards: async (input) => {
      const ids: string[] = [];
      for (const card of input.cards) {
        const created = await database.insightCard.create({
          data: {
            sessionId: input.sessionId,
            signalId: input.signalId,
            insightJson: card as unknown as Prisma.InputJsonValue
          },
          select: { id: true }
        });
        ids.push(created.id);
      }
      return ids;
    },
    saveEvidencePack: async (input) => {
      const created = await database.evidencePack.create({
        data: {
          sessionId: input.sessionId,
          signalId: input.signalId,
          packJson: input.pack as unknown as Prisma.InputJsonValue
        },
        select: { id: true }
      });
      return created.id;
    }
  };
}

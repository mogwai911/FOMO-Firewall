import { db } from "@/lib/db";
import { extractTriageHeadline, pickAiSummaryText } from "@/lib/shared/ai-summary";

export type SessionStatusV2 = "ACTIVE" | "PAUSED" | "CLOSED";
export type JobTypeV2 = "INSIGHT_CARD" | "EVIDENCE_PACK";
export type JobStatusV2 = "QUEUED" | "RUNNING" | "DONE" | "FAILED";

interface SessionDetailRow {
  id: string;
  status: SessionStatusV2;
  createdAt: Date;
  updatedAt: Date;
  signal: {
    id: string;
    title: string;
    summary: string | null;
    url: string;
    source: {
      id: string;
      name: string | null;
    };
  };
  messages: Array<{
    id: string;
    role: "USER" | "ASSISTANT" | "TOOL";
    content: string;
    metaJson: unknown;
    createdAt: Date;
  }>;
  jobs: Array<{
    id: string;
    type: JobTypeV2;
    status: JobStatusV2;
    error: string | null;
    resultRefJson: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

interface SessionRow {
  id: string;
  signalId: string;
  status: SessionStatusV2;
  createdAt: Date;
  updatedAt: Date;
}

interface SessionListRow {
  id: string;
  status: SessionStatusV2;
  createdAt: Date;
  updatedAt: Date;
  signal: {
    id: string;
    title: string;
    summary: string | null;
    triages: Array<{
      triageJson: unknown;
    }>;
    source: {
      id: string;
      name: string | null;
    };
  };
  _count: {
    messages: number;
  };
}

interface SessionReadDeps {
  findSessionDetail: (sessionId: string) => Promise<SessionDetailRow | null>;
  findSessionRef: (sessionId: string) => Promise<{ id: string } | null>;
  updateSessionStatus: (sessionId: string, status: SessionStatusV2) => Promise<SessionRow>;
  deleteSession: (sessionId: string) => Promise<{ id: string }>;
  listSessions: (input: {
    limit: number;
    statuses: SessionStatusV2[];
  }) => Promise<SessionListRow[]>;
}

export class SessionReadServiceError extends Error {
  code: "SESSION_NOT_FOUND" | "INVALID_STATUS";

  constructor(code: "SESSION_NOT_FOUND" | "INVALID_STATUS", message: string) {
    super(message);
    this.code = code;
  }
}

const SESSION_STATUS_SET = new Set<SessionStatusV2>(["ACTIVE", "PAUSED", "CLOSED"]);

export function isSessionStatusV2(value: unknown): value is SessionStatusV2 {
  return typeof value === "string" && SESSION_STATUS_SET.has(value as SessionStatusV2);
}

function defaultDeps(): SessionReadDeps {
  return {
    findSessionDetail: (sessionId) =>
      db.session.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          signal: {
            select: {
              id: true,
              title: true,
              summary: true,
              url: true,
              source: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          messages: {
            orderBy: {
              createdAt: "asc"
            },
            select: {
              id: true,
              role: true,
              content: true,
              metaJson: true,
              createdAt: true
            }
          },
          jobs: {
            orderBy: {
              createdAt: "desc"
            },
            take: 20,
            select: {
              id: true,
              type: true,
              status: true,
              error: true,
              resultRefJson: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      }),
    findSessionRef: (sessionId) =>
      db.session.findUnique({
        where: { id: sessionId },
        select: { id: true }
      }),
    updateSessionStatus: (sessionId, status) =>
      db.session.update({
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
    deleteSession: (sessionId) =>
      db.session.delete({
        where: { id: sessionId },
        select: { id: true }
      }),
    listSessions: ({ limit, statuses }) =>
      db.session.findMany({
        where: {
          status: {
            in: statuses
          }
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: limit,
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          signal: {
            select: {
              id: true,
              title: true,
              summary: true,
              triages: {
                orderBy: {
                  createdAt: "desc"
                },
                take: 1,
                select: {
                  triageJson: true
                }
              },
              source: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          _count: {
            select: {
              messages: true
            }
          }
        }
      })
  };
}

export async function getSessionDetail(
  sessionId: string,
  deps: SessionReadDeps = defaultDeps()
): Promise<{
  id: string;
  status: SessionStatusV2;
  createdAt: string;
  updatedAt: string;
  signal: {
    id: string;
    title: string;
    summary: string | null;
    url: string;
    source: {
      id: string;
      name: string | null;
    };
  };
  messages: Array<{
    id: string;
    role: "USER" | "ASSISTANT" | "TOOL";
    content: string;
    metaJson: unknown;
    createdAt: string;
  }>;
  jobs: Array<{
    id: string;
    type: JobTypeV2;
    status: JobStatusV2;
    error: string | null;
    resultRefJson: unknown;
    createdAt: string;
    updatedAt: string;
  }>;
}> {
  const row = await deps.findSessionDetail(sessionId);
  if (!row) {
    throw new SessionReadServiceError("SESSION_NOT_FOUND", "session not found");
  }

  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    signal: row.signal,
    messages: row.messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString()
    })),
    jobs: row.jobs.map((job) => ({
      ...job,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString()
    }))
  };
}

export async function updateSessionLifecycleStatus(
  input: {
    sessionId: string;
    status: SessionStatusV2;
  },
  deps: SessionReadDeps = defaultDeps()
): Promise<{
  id: string;
  signalId: string;
  status: SessionStatusV2;
  createdAt: string;
  updatedAt: string;
}> {
  if (!isSessionStatusV2(input.status)) {
    throw new SessionReadServiceError("INVALID_STATUS", "invalid session status");
  }

  const session = await deps.findSessionRef(input.sessionId);
  if (!session) {
    throw new SessionReadServiceError("SESSION_NOT_FOUND", "session not found");
  }

  const updated = await deps.updateSessionStatus(input.sessionId, input.status);
  return {
    id: updated.id,
    signalId: updated.signalId,
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString()
  };
}

export async function listRecentSessions(
  input: {
    limit?: number;
    statuses?: SessionStatusV2[];
  },
  deps: SessionReadDeps = defaultDeps()
): Promise<
  Array<{
    id: string;
    status: SessionStatusV2;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    signal: {
      id: string;
      title: string;
      summary: string | null;
      aiSummary: string;
      source: {
        id: string;
        name: string | null;
      };
    };
  }>
> {
  const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 20)));
  const statuses =
    input.statuses && input.statuses.length > 0 ? input.statuses : (["ACTIVE", "PAUSED"] as SessionStatusV2[]);

  const rows = await deps.listSessions({
    limit,
    statuses
  });
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messageCount: row._count.messages,
    signal: {
      id: row.signal.id,
      title: row.signal.title,
      summary: row.signal.summary,
      aiSummary: pickAiSummaryText({
        triageHeadline: extractTriageHeadline(
          Array.isArray(row.signal.triages) ? row.signal.triages[0]?.triageJson : null
        ),
        summary: row.signal.summary
      }),
      source: row.signal.source
    }
  }));
}

export async function deleteSessionById(
  sessionId: string,
  deps: SessionReadDeps = defaultDeps()
): Promise<{ id: string }> {
  const session = await deps.findSessionRef(sessionId);
  if (!session) {
    throw new SessionReadServiceError("SESSION_NOT_FOUND", "session not found");
  }
  const deleted = await deps.deleteSession(sessionId);
  return {
    id: deleted.id
  };
}

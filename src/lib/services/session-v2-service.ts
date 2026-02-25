import { createAppStorage } from "@/lib/storage/app-storage";
import { recordEventV2 } from "@/lib/services/eventlog-v2-service";
import type { Prisma } from "@prisma/client";

export type MessageRoleInput = "user" | "assistant" | "tool";

export interface SessionView {
  id: string;
  signalId: string;
  status: "ACTIVE" | "PAUSED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
}

export interface SessionMessageView {
  id: string;
  sessionId: string;
  role: "USER" | "ASSISTANT" | "TOOL";
  content: string;
  metaJson: unknown;
  createdAt: string;
}

interface SessionRecord {
  id: string;
  signalId: string;
  status: "ACTIVE" | "PAUSED" | "CLOSED";
  createdAt: Date;
  updatedAt: Date;
}

interface MessageRecord {
  id: string;
  sessionId: string;
  role: "USER" | "ASSISTANT" | "TOOL";
  content: string;
  metaJson: unknown;
  createdAt: Date;
}

interface SessionDeps {
  findSignal: (signalId: string) => Promise<{ id: string } | null>;
  findLatestSession: (signalId: string) => Promise<SessionRecord | null>;
  createSession: (signalId: string) => Promise<SessionRecord>;
  updateSessionStatus: (
    sessionId: string,
    status: "ACTIVE" | "PAUSED" | "CLOSED"
  ) => Promise<SessionRecord>;
  findSession: (sessionId: string) => Promise<{ id: string } | null>;
  createMessage: (input: {
    sessionId: string;
    role: "USER" | "ASSISTANT" | "TOOL";
    content: string;
    metaJson?: Prisma.InputJsonValue;
  }) => Promise<MessageRecord>;
  recordEvent?: (input: {
    type: "SESSION_ENTERED" | "SESSION_RESUMED" | "SESSION_MESSAGE_APPENDED";
    signalId?: string;
    sessionId: string;
    payloadJson?: Prisma.InputJsonValue;
  }) => Promise<unknown>;
}

export class SessionServiceError extends Error {
  code: "SIGNAL_NOT_FOUND" | "SESSION_NOT_FOUND" | "INVALID_ROLE" | "EMPTY_CONTENT";

  constructor(code: "SIGNAL_NOT_FOUND" | "SESSION_NOT_FOUND" | "INVALID_ROLE" | "EMPTY_CONTENT", message: string) {
    super(message);
    this.code = code;
  }
}

function defaultDeps(): SessionDeps {
  const storage = createAppStorage();
  return {
    findSignal: (signalId) => storage.findSignalRef(signalId),
    findLatestSession: (signalId) => storage.findLatestResumableSessionBySignal(signalId),
    createSession: (signalId) => storage.createSession({ signalId, status: "ACTIVE" }),
    updateSessionStatus: (sessionId, status) => storage.updateSessionStatus(sessionId, status),
    findSession: (sessionId) => storage.findSessionRef(sessionId),
    createMessage: (input) => storage.createSessionMessage(input),
    recordEvent: (input) => recordEventV2(input)
  };
}

function toSessionView(session: SessionRecord): SessionView {
  return {
    id: session.id,
    signalId: session.signalId,
    status: session.status,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString()
  };
}

function toMessageView(message: MessageRecord): SessionMessageView {
  return {
    id: message.id,
    sessionId: message.sessionId,
    role: message.role,
    content: message.content,
    metaJson: message.metaJson,
    createdAt: message.createdAt.toISOString()
  };
}

function normalizeRole(role: MessageRoleInput): "USER" | "ASSISTANT" | "TOOL" {
  if (role === "user") return "USER";
  if (role === "assistant") return "ASSISTANT";
  if (role === "tool") return "TOOL";
  throw new SessionServiceError("INVALID_ROLE", "invalid message role");
}

export async function createOrResumeSession(
  input: { signalId: string },
  deps: SessionDeps = defaultDeps()
): Promise<SessionView> {
  const signal = await deps.findSignal(input.signalId);
  if (!signal) {
    throw new SessionServiceError("SIGNAL_NOT_FOUND", "signal not found");
  }

  const existing = await deps.findLatestSession(input.signalId);
  if (existing) {
    const resumed = await deps.updateSessionStatus(existing.id, "ACTIVE");
    if (deps.recordEvent) {
      await deps.recordEvent({
        type: "SESSION_RESUMED",
        signalId: input.signalId,
        sessionId: resumed.id,
        payloadJson: {
          resumedFromStatus: existing.status
        }
      });
    }
    return toSessionView(resumed);
  }

  const created = await deps.createSession(input.signalId);
  if (deps.recordEvent) {
    await deps.recordEvent({
      type: "SESSION_ENTERED",
      signalId: input.signalId,
      sessionId: created.id,
      payloadJson: {
        created: true
      }
    });
  }
  return toSessionView(created);
}

export async function appendSessionMessage(
  input: {
    sessionId: string;
    role: MessageRoleInput;
    content: string;
    metaJson?: unknown;
  },
  deps: SessionDeps = defaultDeps()
): Promise<SessionMessageView> {
  const content = input.content.trim();
  if (!content) {
    throw new SessionServiceError("EMPTY_CONTENT", "message content is empty");
  }

  const session = await deps.findSession(input.sessionId);
  if (!session) {
    throw new SessionServiceError("SESSION_NOT_FOUND", "session not found");
  }

  const role = normalizeRole(input.role);
  await deps.updateSessionStatus(input.sessionId, "ACTIVE");

  const created = await deps.createMessage({
    sessionId: input.sessionId,
    role,
    content,
    metaJson:
      input.metaJson === undefined ? undefined : (input.metaJson as Prisma.InputJsonValue)
  });
  if (deps.recordEvent) {
    await deps.recordEvent({
      type: "SESSION_MESSAGE_APPENDED",
      sessionId: input.sessionId,
      payloadJson: {
        role
      }
    });
  }

  return toMessageView(created);
}

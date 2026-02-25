import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type EventTypeV2 =
  | "DISPOSITION_SET"
  | "DISPOSITION_CHANGED"
  | "TRIAGE_EXPANDED"
  | "SESSION_ENTERED"
  | "SESSION_RESUMED"
  | "SESSION_MESSAGE_APPENDED"
  | "JOB_ENQUEUED";

const EVENT_TYPES = new Set<EventTypeV2>([
  "DISPOSITION_SET",
  "DISPOSITION_CHANGED",
  "TRIAGE_EXPANDED",
  "SESSION_ENTERED",
  "SESSION_RESUMED",
  "SESSION_MESSAGE_APPENDED",
  "JOB_ENQUEUED"
]);

interface EventLogRecord {
  id: string;
  type: EventTypeV2;
  signalId: string | null;
  sessionId: string | null;
  jobId: string | null;
  payloadJson: unknown;
  createdAt: Date;
}

interface EventLogDeps {
  createEvent: (input: {
    type: EventTypeV2;
    signalId?: string;
    sessionId?: string;
    jobId?: string;
    payloadJson?: Prisma.InputJsonValue;
  }) => Promise<EventLogRecord>;
}

export interface SignalFeedbackSummary {
  dispositionSet: number;
  dispositionChanged: number;
  triageExpanded: number;
  sessionEntered: number;
  sessionResumed: number;
  jobsRequested: number;
}

export class EventLogServiceError extends Error {
  code: "INVALID_EVENT_TYPE";

  constructor(code: "INVALID_EVENT_TYPE", message: string) {
    super(message);
    this.code = code;
  }
}

function defaultDeps(): EventLogDeps {
  return {
    createEvent: (input) =>
      db.eventLogV2.create({
        data: {
          type: input.type,
          signalId: input.signalId,
          sessionId: input.sessionId,
          jobId: input.jobId,
          payloadJson: input.payloadJson
        },
        select: {
          id: true,
          type: true,
          signalId: true,
          sessionId: true,
          jobId: true,
          payloadJson: true,
          createdAt: true
        }
      })
  };
}

export function isEventTypeV2(value: unknown): value is EventTypeV2 {
  return typeof value === "string" && EVENT_TYPES.has(value as EventTypeV2);
}

export async function recordEventV2(
  input: {
    type: EventTypeV2;
    signalId?: string;
    sessionId?: string;
    jobId?: string;
    payloadJson?: Prisma.InputJsonValue;
  },
  deps: EventLogDeps = defaultDeps()
): Promise<{
  id: string;
  type: EventTypeV2;
  signalId: string | null;
  sessionId: string | null;
  jobId: string | null;
  payloadJson: unknown;
  createdAt: string;
}> {
  if (!isEventTypeV2(input.type)) {
    throw new EventLogServiceError("INVALID_EVENT_TYPE", "invalid event type");
  }

  const created = await deps.createEvent(input);
  return {
    id: created.id,
    type: created.type,
    signalId: created.signalId,
    sessionId: created.sessionId,
    jobId: created.jobId,
    payloadJson: created.payloadJson,
    createdAt: created.createdAt.toISOString()
  };
}

function createEmptySummary(): SignalFeedbackSummary {
  return {
    dispositionSet: 0,
    dispositionChanged: 0,
    triageExpanded: 0,
    sessionEntered: 0,
    sessionResumed: 0,
    jobsRequested: 0
  };
}

export function summarizeSignalFeedback(
  events: Array<{ type: EventTypeV2; signalId: string | null }>
): Record<string, SignalFeedbackSummary> {
  const output: Record<string, SignalFeedbackSummary> = {};
  for (const event of events) {
    if (!event.signalId) {
      continue;
    }
    if (!output[event.signalId]) {
      output[event.signalId] = createEmptySummary();
    }
    const current = output[event.signalId];
    if (event.type === "DISPOSITION_SET") current.dispositionSet += 1;
    if (event.type === "DISPOSITION_CHANGED") current.dispositionChanged += 1;
    if (event.type === "TRIAGE_EXPANDED") current.triageExpanded += 1;
    if (event.type === "SESSION_ENTERED") current.sessionEntered += 1;
    if (event.type === "SESSION_RESUMED") current.sessionResumed += 1;
    if (event.type === "JOB_ENQUEUED") current.jobsRequested += 1;
  }
  return output;
}

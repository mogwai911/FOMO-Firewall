import { db } from "@/lib/db";
import { recordEventV2 } from "@/lib/services/eventlog-v2-service";

export type DispositionLabel = "FYI" | "DO" | "DROP";

interface DispositionRecord {
  id: string;
  signalId: string;
  label: DispositionLabel;
  isOverride: boolean;
  updatedAt: Date;
}

interface DispositionDeps {
  findSignal: (signalId: string) => Promise<{ id: string } | null>;
  findDisposition: (signalId: string) => Promise<{ label: DispositionLabel } | null>;
  upsertDisposition: (input: {
    signalId: string;
    label: DispositionLabel;
    isOverride: boolean;
  }) => Promise<DispositionRecord>;
  recordEvent?: (input: {
    type: "DISPOSITION_SET" | "DISPOSITION_CHANGED";
    signalId: string;
    payloadJson: {
      fromLabel: DispositionLabel | null;
      toLabel: DispositionLabel;
      isOverride: boolean;
    };
  }) => Promise<unknown>;
}

export class DispositionServiceError extends Error {
  code: "SIGNAL_NOT_FOUND" | "INVALID_LABEL";

  constructor(code: "SIGNAL_NOT_FOUND" | "INVALID_LABEL", message: string) {
    super(message);
    this.code = code;
  }
}

const DISPOSITION_SET = new Set<DispositionLabel>(["FYI", "DO", "DROP"]);

export function isDispositionLabel(value: unknown): value is DispositionLabel {
  return typeof value === "string" && DISPOSITION_SET.has(value as DispositionLabel);
}

function defaultDeps(): DispositionDeps {
  return {
    findSignal: (signalId) =>
      db.signal.findUnique({
        where: { id: signalId },
        select: { id: true }
      }),
    findDisposition: (signalId) =>
      db.signalDisposition.findUnique({
        where: { signalId },
        select: {
          label: true
        }
      }),
    upsertDisposition: (input) =>
      db.signalDisposition.upsert({
        where: { signalId: input.signalId },
        create: {
          signalId: input.signalId,
          label: input.label,
          isOverride: input.isOverride
        },
        update: {
          label: input.label,
          isOverride: input.isOverride
        },
        select: {
          id: true,
          signalId: true,
          label: true,
          isOverride: true,
          updatedAt: true
        }
      }),
    recordEvent: (input) => recordEventV2(input)
  };
}

export async function setSignalDisposition(
  input: {
    signalId: string;
    label: DispositionLabel;
    isOverride?: boolean;
  },
  deps: DispositionDeps = defaultDeps()
): Promise<{ id: string; signalId: string; label: DispositionLabel; isOverride: boolean; updatedAt: string }> {
  if (!isDispositionLabel(input.label)) {
    throw new DispositionServiceError("INVALID_LABEL", "invalid disposition label");
  }

  const signal = await deps.findSignal(input.signalId);
  if (!signal) {
    throw new DispositionServiceError("SIGNAL_NOT_FOUND", "signal not found");
  }
  const previous = await deps.findDisposition(input.signalId);

  const row = await deps.upsertDisposition({
    signalId: input.signalId,
    label: input.label,
    isOverride: input.isOverride ?? true
  });
  const payload = {
    fromLabel: previous?.label ?? null,
    toLabel: row.label,
    isOverride: row.isOverride
  };
  if (deps.recordEvent) {
    await deps.recordEvent({
      type: "DISPOSITION_SET",
      signalId: row.signalId,
      payloadJson: payload
    });
    if (previous && previous.label !== row.label) {
      await deps.recordEvent({
        type: "DISPOSITION_CHANGED",
        signalId: row.signalId,
        payloadJson: payload
      });
    }
  }

  return {
    id: row.id,
    signalId: row.signalId,
    label: row.label,
    isOverride: row.isOverride,
    updatedAt: row.updatedAt.toISOString()
  };
}

import { db } from "@/lib/db";

export class SignalEnterSessionServiceError extends Error {
  code: "SIGNAL_NOT_FOUND";

  constructor(code: "SIGNAL_NOT_FOUND", message: string) {
    super(message);
    this.code = code;
  }
}

export async function enterSessionFromSignal(input: {
  signalId: string;
}): Promise<{
  disposition: {
    id: string;
    signalId: string;
    label: "DO";
    isOverride: boolean;
    updatedAt: string;
  };
  session: {
    id: string;
    signalId: string;
    status: "ACTIVE" | "PAUSED" | "CLOSED";
    createdAt: string;
    updatedAt: string;
  };
}> {
  return db.$transaction(async (tx) => {
    const signal = await tx.signal.findUnique({
      where: {
        id: input.signalId
      },
      select: {
        id: true
      }
    });
    if (!signal) {
      throw new SignalEnterSessionServiceError("SIGNAL_NOT_FOUND", "signal not found");
    }

    const previous = await tx.signalDisposition.findUnique({
      where: {
        signalId: input.signalId
      },
      select: {
        label: true
      }
    });

    const disposition = await tx.signalDisposition.upsert({
      where: {
        signalId: input.signalId
      },
      create: {
        signalId: input.signalId,
        label: "DO",
        isOverride: true
      },
      update: {
        label: "DO",
        isOverride: true
      },
      select: {
        id: true,
        signalId: true,
        label: true,
        isOverride: true,
        updatedAt: true
      }
    });

    const payload = {
      fromLabel: previous?.label ?? null,
      toLabel: "DO",
      isOverride: true
    };
    await tx.eventLogV2.create({
      data: {
        type: "DISPOSITION_SET",
        signalId: input.signalId,
        payloadJson: payload
      }
    });
    if (previous && previous.label !== "DO") {
      await tx.eventLogV2.create({
        data: {
          type: "DISPOSITION_CHANGED",
          signalId: input.signalId,
          payloadJson: payload
        }
      });
    }

    const existing = await tx.session.findFirst({
      where: {
        signalId: input.signalId,
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
    });

    if (existing) {
      const session = await tx.session.update({
        where: {
          id: existing.id
        },
        data: {
          status: "ACTIVE"
        },
        select: {
          id: true,
          signalId: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      });
      await tx.eventLogV2.create({
        data: {
          type: "SESSION_RESUMED",
          signalId: input.signalId,
          sessionId: session.id,
          payloadJson: {
            resumedFromStatus: existing.status
          }
        }
      });
      return {
        disposition: {
          id: disposition.id,
          signalId: disposition.signalId,
          label: "DO",
          isOverride: disposition.isOverride,
          updatedAt: disposition.updatedAt.toISOString()
        },
        session: {
          ...session,
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString()
        }
      };
    }

    const session = await tx.session.create({
      data: {
        signalId: input.signalId,
        status: "ACTIVE"
      },
      select: {
        id: true,
        signalId: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });
    await tx.eventLogV2.create({
      data: {
        type: "SESSION_ENTERED",
        signalId: input.signalId,
        sessionId: session.id,
        payloadJson: {
          created: true
        }
      }
    });

    return {
      disposition: {
        id: disposition.id,
        signalId: disposition.signalId,
        label: "DO",
        isOverride: disposition.isOverride,
        updatedAt: disposition.updatedAt.toISOString()
      },
      session: {
        ...session,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString()
      }
    };
  });
}

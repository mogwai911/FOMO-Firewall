import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { RoleV2 } from "@/lib/services/digest-service";
import { generateDigestForDate, type DigestOutput } from "@/lib/services/digest-service";
import {
  ingestSignalsFromEnabledSources,
  type SignalIngestionSummary
} from "@/lib/services/signal-ingest";
import { prefetchSignalPreview } from "@/lib/services/signal-preview-service";
import { generateTriageForSignal } from "@/lib/services/triage-v2-service";
import {
  buildDateWindowForDateKey,
  DateWindowTimeZoneError,
  isValidTimeZone,
  shiftDateKeyByDays
} from "@/lib/time/date-window";

export type DigestResetMode = "PRESERVE_DISPOSITIONS" | "RESET_DISPOSITIONS";
export type DigestWindowDays = 1 | 3 | 7;

export interface DigestStatusView {
  hasDigest: boolean;
  generatedAt: string | null;
  signalCount: number;
  processedCount: number;
}

interface DigestSnapshotRecord {
  dateKey: string;
  windowDays: number;
  signalIdsJson: unknown;
  refreshMetaJson: unknown;
  updatedAt: Date;
}

interface DigestRunRecord {
  dateKey: string;
  mode: "MANUAL" | "SCHEDULED";
  signalCount: number;
  processedCount: number;
  updatedAt: Date;
}

interface DigestManualRefreshDeps {
  findDigestSnapshot: (input: {
    dateKey: string;
    windowDays: DigestWindowDays;
  }) => Promise<DigestSnapshotRecord | null>;
  findDigestRun: (dateKey: string) => Promise<DigestRunRecord | null>;
  upsertDigestSnapshot: (input: {
    dateKey: string;
    windowDays: DigestWindowDays;
    signalIds: string[];
    refreshMetaJson: Prisma.InputJsonValue;
  }) => Promise<DigestSnapshotRecord>;
  upsertDigestRun: (input: {
    dateKey: string;
    mode: "MANUAL" | "SCHEDULED";
    signalCount: number;
    processedCount: number;
  }) => Promise<DigestRunRecord>;
  runIngestion: () => Promise<SignalIngestionSummary>;
  generateDigest: (input: {
    dateKey: string;
    limit: number;
    role: RoleV2;
    timezone: string;
    windowDays: DigestWindowDays;
  }) => Promise<DigestOutput>;
  prefetchSignalTriage: (input: {
    signalIds: string[];
    role: RoleV2;
  }) => Promise<TriagePrefetchSummary>;
  prefetchSignalPreview: (input: { signalIds: string[] }) => Promise<{
    requested: number;
    generated: number;
    failed: number;
    errors: Array<{ signalId: string; message: string }>;
  }>;
  resetDigestDataForDate: (
    dateKey: string,
    timezone: string,
    windowDays: DigestWindowDays
  ) => Promise<void>;
  countProcessedSignals: (
    dateKey: string,
    timezone: string,
    windowDays: DigestWindowDays
  ) => Promise<number>;
}

export class DigestManualRefreshServiceError extends Error {
  code:
    | "INVALID_DATE"
    | "DIGEST_ALREADY_EXISTS"
    | "INVALID_RESET_MODE"
    | "INVALID_TIMEZONE"
    | "INVALID_WINDOW_DAYS"
    | "INVALID_LIMIT";

  constructor(
    code:
      | "INVALID_DATE"
      | "DIGEST_ALREADY_EXISTS"
      | "INVALID_RESET_MODE"
      | "INVALID_TIMEZONE"
      | "INVALID_WINDOW_DAYS"
      | "INVALID_LIMIT",
    message: string
  ) {
    super(message);
    this.code = code;
  }
}

export interface TriagePrefetchSummary {
  requested: number;
  generated: number;
  failed: number;
  errors: Array<{ signalId: string; message: string }>;
}

function normalizeTimezone(input: string | undefined): string {
  const normalized = input?.trim() || "UTC";
  if (!isValidTimeZone(normalized)) {
    throw new DigestManualRefreshServiceError("INVALID_TIMEZONE", "invalid timezone");
  }
  return normalized;
}

function normalizeWindowDays(value: number | undefined): DigestWindowDays {
  if (value === undefined) {
    return 1;
  }
  if (!Number.isFinite(value)) {
    throw new DigestManualRefreshServiceError("INVALID_WINDOW_DAYS", "windowDays must be 1, 3, or 7");
  }
  const rounded = Math.round(value);
  if (rounded === 1 || rounded === 3 || rounded === 7) {
    return rounded;
  }
  throw new DigestManualRefreshServiceError("INVALID_WINDOW_DAYS", "windowDays must be 1, 3, or 7");
}

function normalizeDigestLimit(value: number | undefined): number {
  if (value === undefined) {
    return 100;
  }
  if (!Number.isFinite(value)) {
    throw new DigestManualRefreshServiceError("INVALID_LIMIT", "limit must be within 1~200");
  }
  const rounded = Math.round(value);
  if (rounded < 1 || rounded > 200) {
    throw new DigestManualRefreshServiceError("INVALID_LIMIT", "limit must be within 1~200");
  }
  return rounded;
}

function parseDateWindow(
  dateKey: string,
  timezone: string,
  windowDays: DigestWindowDays = 1
): { start: Date; endExclusive: Date } {
  try {
    const startDateKey =
      windowDays > 1 ? shiftDateKeyByDays(dateKey, -(windowDays - 1)) : dateKey;
    const startWindow = buildDateWindowForDateKey(startDateKey, timezone);
    const endWindow = buildDateWindowForDateKey(dateKey, timezone);
    return {
      start: startWindow.start,
      endExclusive: endWindow.endExclusive
    };
  } catch (error) {
    if (error instanceof DateWindowTimeZoneError) {
      throw new DigestManualRefreshServiceError(error.code, error.message);
    }
    throw error;
  }
}

function mapStatus(row: DigestRunRecord | null): DigestStatusView {
  if (!row) {
    return {
      hasDigest: false,
      generatedAt: null,
      signalCount: 0,
      processedCount: 0
    };
  }
  return {
    hasDigest: true,
    generatedAt: row.updatedAt.toISOString(),
    signalCount: row.signalCount,
    processedCount: row.processedCount
  };
}

function isDigestResetMode(value: unknown): value is DigestResetMode {
  return value === "PRESERVE_DISPOSITIONS" || value === "RESET_DISPOSITIONS";
}

function defaultDeps(): DigestManualRefreshDeps {
  return {
    findDigestSnapshot: ({ dateKey, windowDays }) =>
      db.digestSnapshot.findUnique({
        where: {
          dateKey_windowDays: {
            dateKey,
            windowDays
          }
        },
        select: {
          dateKey: true,
          windowDays: true,
          signalIdsJson: true,
          refreshMetaJson: true,
          updatedAt: true
        }
      }),
    findDigestRun: (dateKey) =>
      db.digestRun.findUnique({
        where: {
          dateKey
        },
        select: {
          dateKey: true,
          mode: true,
          signalCount: true,
          processedCount: true,
          updatedAt: true
        }
      }),
    upsertDigestRun: (input) =>
      db.digestRun.upsert({
        where: {
          dateKey: input.dateKey
        },
        create: input,
        update: input,
        select: {
          dateKey: true,
          mode: true,
          signalCount: true,
          processedCount: true,
          updatedAt: true
        }
      }),
    upsertDigestSnapshot: (input) =>
      db.digestSnapshot.upsert({
        where: {
          dateKey_windowDays: {
            dateKey: input.dateKey,
            windowDays: input.windowDays
          }
        },
        create: {
          dateKey: input.dateKey,
          windowDays: input.windowDays,
          signalIdsJson: input.signalIds,
          refreshMetaJson: input.refreshMetaJson
        },
        update: {
          signalIdsJson: input.signalIds,
          refreshMetaJson: input.refreshMetaJson
        },
        select: {
          dateKey: true,
          windowDays: true,
          signalIdsJson: true,
          refreshMetaJson: true,
          updatedAt: true
        }
      }),
    runIngestion: () => ingestSignalsFromEnabledSources(),
    generateDigest: ({ dateKey, limit, role, timezone, windowDays }) =>
      generateDigestForDate({
        dateKey,
        limit,
        role,
        timezone,
        windowDays
      }),
    prefetchSignalTriage: async ({ signalIds, role }) => {
      const uniqueSignalIds = Array.from(new Set(signalIds));
      let generated = 0;
      const errors: Array<{ signalId: string; message: string }> = [];

      for (const signalId of uniqueSignalIds) {
        try {
          await generateTriageForSignal({
            signalId,
            role
          });
          generated += 1;
        } catch (error) {
          errors.push({
            signalId,
            message: error instanceof Error ? error.message : "triage prefetch failed"
          });
        }
      }

      return {
        requested: uniqueSignalIds.length,
        generated,
        failed: errors.length,
        errors
      };
    },
    prefetchSignalPreview: ({ signalIds }) => prefetchSignalPreview({ signalIds }),
    resetDigestDataForDate: async (dateKey, timezone, windowDays) => {
      const { start, endExclusive } = parseDateWindow(dateKey, timezone, windowDays);
      await db.$transaction([
        db.signalDisposition.deleteMany({
          where: {
            signal: {
              OR: [
                {
                  publishedAt: {
                    gte: start,
                    lt: endExclusive
                  }
                },
                {
                  publishedAt: null,
                  createdAt: {
                    gte: start,
                    lt: endExclusive
                  }
                }
              ]
            }
          }
        }),
        db.signalTriage.deleteMany({
          where: {
            signal: {
              OR: [
                {
                  publishedAt: {
                    gte: start,
                    lt: endExclusive
                  }
                },
                {
                  publishedAt: null,
                  createdAt: {
                    gte: start,
                    lt: endExclusive
                  }
                }
              ]
            }
          }
        })
      ]);
    },
    countProcessedSignals: (dateKey, timezone, windowDays) => {
      const { start, endExclusive } = parseDateWindow(dateKey, timezone, windowDays);
      return db.signalDisposition.count({
        where: {
          signal: {
            OR: [
              {
                publishedAt: {
                  gte: start,
                  lt: endExclusive
                }
              },
              {
                publishedAt: null,
                createdAt: {
                  gte: start,
                  lt: endExclusive
                }
              }
            ]
          }
        }
      });
    }
  };
}

export async function getDigestStatus(
  input: { dateKey: string; windowDays?: number },
  deps: Pick<DigestManualRefreshDeps, "findDigestSnapshot" | "findDigestRun"> = defaultDeps()
): Promise<DigestStatusView> {
  const windowDays = normalizeWindowDays(input.windowDays);
  parseDateWindow(input.dateKey, "UTC", windowDays);
  const snapshot = await deps.findDigestSnapshot({
    dateKey: input.dateKey,
    windowDays
  });
  if (snapshot) {
    const signalCount = Array.isArray(snapshot.signalIdsJson) ? snapshot.signalIdsJson.length : 0;
    const row = await deps.findDigestRun(input.dateKey);
    return {
      hasDigest: true,
      generatedAt: snapshot.updatedAt.toISOString(),
      signalCount,
      processedCount: row?.processedCount ?? 0
    };
  }
  return {
    hasDigest: false,
    generatedAt: null,
    signalCount: 0,
    processedCount: 0
  };
}

export async function manualRefreshDigest(
  input: {
    dateKey: string;
    overwrite?: boolean;
    resetMode?: DigestResetMode;
    role?: RoleV2;
    timezone?: string;
    windowDays?: number;
    limit?: number;
  },
  deps: DigestManualRefreshDeps = defaultDeps()
): Promise<{
  status: DigestStatusView;
  digest: DigestOutput;
  ingestionSummary: SignalIngestionSummary;
  triageSummary: TriagePrefetchSummary;
}> {
  const timezone = normalizeTimezone(input.timezone);
  const windowDays = normalizeWindowDays(input.windowDays);
  const limit = normalizeDigestLimit(input.limit);
  parseDateWindow(input.dateKey, timezone, windowDays);
  const overwrite = Boolean(input.overwrite);
  const resetMode = input.resetMode ?? "PRESERVE_DISPOSITIONS";
  const role = input.role ?? "ENG";

  if (!isDigestResetMode(resetMode)) {
    throw new DigestManualRefreshServiceError("INVALID_RESET_MODE", "invalid reset mode");
  }

  const currentSnapshot = await deps.findDigestSnapshot({
    dateKey: input.dateKey,
    windowDays
  });
  if (currentSnapshot && !overwrite) {
    throw new DigestManualRefreshServiceError(
      "DIGEST_ALREADY_EXISTS",
      "digest already exists for this date"
    );
  }

  if (currentSnapshot && overwrite && resetMode === "RESET_DISPOSITIONS") {
    await deps.resetDigestDataForDate(input.dateKey, timezone, windowDays);
  }

  const ingestionSummary = await deps.runIngestion();
  const digestBeforeTriage = await deps.generateDigest({
    dateKey: input.dateKey,
    limit,
    role,
    timezone,
    windowDays
  });
  const missingTriageSignalIds = digestBeforeTriage.signals
    .filter((signal) => !signal.triage)
    .map((signal) => signal.id);
  const triageSummary = await deps.prefetchSignalTriage({
    signalIds: missingTriageSignalIds,
    role
  });
  const digest =
    triageSummary.generated > 0
      ? await deps.generateDigest({
          dateKey: input.dateKey,
          limit,
          role,
          timezone,
          windowDays
        })
      : digestBeforeTriage;
  await deps.prefetchSignalPreview({
    signalIds: digest.signals.map((signal) => signal.id)
  });

  const processedCount = await deps.countProcessedSignals(input.dateKey, timezone, windowDays);
  const run = await deps.upsertDigestRun({
    dateKey: input.dateKey,
    mode: "MANUAL",
    signalCount: digest.count,
    processedCount
  });
  await deps.upsertDigestSnapshot({
    dateKey: input.dateKey,
    windowDays,
    signalIds: digest.signals.map((signal) => signal.id),
    refreshMetaJson: {
      ingestion: {
        sources: ingestionSummary.sources,
        signals: ingestionSummary.signals,
        duplicates: ingestionSummary.duplicates,
        errors: ingestionSummary.errors.length,
        errorDetails: ingestionSummary.errors.map((entry) => ({
          sourceId: entry.sourceId,
          sourceName: entry.sourceName,
          rssUrl: entry.rssUrl,
          message: entry.message
        }))
      },
      triage: {
        requested: triageSummary.requested,
        generated: triageSummary.generated,
        failed: triageSummary.failed
      }
    }
  });

  return {
    status: mapStatus(run),
    digest,
    ingestionSummary,
    triageSummary
  };
}

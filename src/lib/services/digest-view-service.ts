import { db } from "@/lib/db";

export type DigestWindowDays = 1 | 3 | 7;
export type DispositionLabel = "FYI" | "DO" | "DROP";

interface DigestSnapshotRow {
  id: string;
  dateKey: string;
  windowDays: number;
  signalIdsJson: unknown;
  refreshMetaJson: unknown;
  updatedAt: Date;
}

interface DigestRunRow {
  dateKey: string;
  mode: "MANUAL" | "SCHEDULED";
  signalCount: number;
  processedCount: number;
  updatedAt: Date;
}

interface SignalRow {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: Date | null;
  source: {
    id: string;
    name: string | null;
  };
  dispositions: Array<{
    label: DispositionLabel;
  }>;
  triages: Array<{
    triageJson: unknown;
  }>;
}

interface DigestViewDeps {
  findDigestSnapshot: (input: {
    dateKey: string;
    windowDays: DigestWindowDays;
  }) => Promise<DigestSnapshotRow | null>;
  findDigestRun: (dateKey: string) => Promise<DigestRunRow | null>;
  listSignalsByIds: (signalIds: string[]) => Promise<SignalRow[]>;
}

interface TriageLike {
  label?: unknown;
  score?: unknown;
}

interface DigestRefreshStats {
  ingestion: {
    sources: number;
    signals: number;
    duplicates: number;
    errors: number;
    errorDetails: Array<{
      sourceId: string;
      sourceName: string | null;
      rssUrl: string;
      message: string;
    }>;
  };
  triage: {
    requested: number;
    generated: number;
    failed: number;
  };
}

function parseErrorDetails(value: unknown): Array<{
  sourceId: string;
  sourceName: string | null;
  rssUrl: string;
  message: string;
}> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      const row = asObject(entry);
      if (!row) {
        return null;
      }
      const sourceId = typeof row.sourceId === "string" ? row.sourceId.trim() : "";
      const rssUrl = typeof row.rssUrl === "string" ? row.rssUrl.trim() : "";
      const message = typeof row.message === "string" ? row.message.trim() : "";
      const sourceName =
        typeof row.sourceName === "string" ? row.sourceName : row.sourceName === null ? null : null;
      if (!sourceId || !rssUrl || !message) {
        return null;
      }
      return {
        sourceId,
        sourceName,
        rssUrl,
        message
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

export class DigestViewServiceError extends Error {
  code: "INVALID_WINDOW_DAYS";

  constructor(code: "INVALID_WINDOW_DAYS", message: string) {
    super(message);
    this.code = code;
  }
}

function defaultDeps(): DigestViewDeps {
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
          id: true,
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
    listSignalsByIds: (signalIds) =>
      db.signal.findMany({
        where: {
          id: {
            in: signalIds
          }
        },
        select: {
          id: true,
          title: true,
          url: true,
          summary: true,
          publishedAt: true,
          source: {
            select: {
              id: true,
              name: true
            }
          },
          dispositions: {
            select: {
              label: true
            }
          },
          triages: {
            orderBy: {
              createdAt: "desc"
            },
            take: 1,
            select: {
              triageJson: true
            }
          }
        }
      })
  };
}

function normalizeWindowDays(value: number | undefined): DigestWindowDays {
  if (value === undefined) {
    return 1;
  }
  if (!Number.isFinite(value)) {
    throw new DigestViewServiceError("INVALID_WINDOW_DAYS", "windowDays must be 1, 3, or 7");
  }
  const rounded = Math.round(value);
  if (rounded === 1 || rounded === 3 || rounded === 7) {
    return rounded;
  }
  throw new DigestViewServiceError("INVALID_WINDOW_DAYS", "windowDays must be 1, 3, or 7");
}

function toSignalIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
}

function parseRefreshStats(value: unknown): DigestRefreshStats | null {
  const json = asObject(value);
  if (!json) {
    return null;
  }
  const ingestion = asObject(json.ingestion);
  const triage = asObject(json.triage);
  if (!ingestion || !triage) {
    return null;
  }
  return {
    ingestion: {
      sources: asNumber(ingestion.sources),
      signals: asNumber(ingestion.signals),
      duplicates: asNumber(ingestion.duplicates),
      errors: asNumber(ingestion.errors),
      errorDetails: parseErrorDetails(ingestion.errorDetails)
    },
    triage: {
      requested: asNumber(triage.requested),
      generated: asNumber(triage.generated),
      failed: asNumber(triage.failed)
    }
  };
}

function asTriage(value: unknown): TriageLike {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as TriageLike;
}

function normalizeLabel(value: unknown): DispositionLabel {
  if (value === "FYI" || value === "DO" || value === "DROP") {
    return value;
  }
  return "FYI";
}

function normalizeScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function getDigestView(
  input: {
    dateKey: string;
    windowDays?: number;
  },
  deps: DigestViewDeps = defaultDeps()
): Promise<{
  hasSnapshot: boolean;
  digest: {
    dateKey: string;
    count: number;
    signals: Array<{
      id: string;
      title: string;
      url: string;
      summary: string | null;
      publishedAt: string | null;
      source: {
        id: string;
        name: string | null;
      };
      disposition: DispositionLabel | null;
      triage: unknown;
      routing: {
        label: DispositionLabel;
        score: number;
      };
    }>;
  };
  counts: {
    total: number;
    pending: number;
    processed: number;
    later: number;
    do: number;
    drop: number;
  };
  lastRefresh: DigestRefreshStats | null;
  generatedAt: string | null;
  legacyDigestRunExists: boolean;
  legacyNotice: string | null;
}> {
  const windowDays = normalizeWindowDays(input.windowDays);
  const snapshot = await deps.findDigestSnapshot({
    dateKey: input.dateKey,
    windowDays
  });
  const run = await deps.findDigestRun(input.dateKey);

  if (!snapshot) {
    return {
      hasSnapshot: false,
      digest: {
        dateKey: input.dateKey,
        count: 0,
        signals: []
      },
      counts: {
        total: 0,
        pending: 0,
        processed: 0,
        later: 0,
        do: 0,
        drop: 0
      },
      lastRefresh: null,
      generatedAt: null,
      legacyDigestRunExists: Boolean(run),
      legacyNotice: run
        ? "检测到旧版日报数据，请点击“更新这段时间日报”完成快照迁移。"
        : null
    };
  }

  const signalIds = toSignalIds(snapshot.signalIdsJson);
  const rows = signalIds.length > 0 ? await deps.listSignalsByIds(signalIds) : [];
  const rowById = new Map(rows.map((row) => [row.id, row]));

  const signals = signalIds
    .map((signalId) => rowById.get(signalId))
    .filter((row): row is SignalRow => Boolean(row))
    .map((row) => {
      const triage = row.triages[0]?.triageJson ?? null;
      const triageCard = asTriage(triage);
      return {
        id: row.id,
        title: row.title,
        url: row.url,
        summary: row.summary,
        publishedAt: row.publishedAt?.toISOString() ?? null,
        source: row.source,
        disposition: row.dispositions[0]?.label ?? null,
        triage,
        routing: {
          label: normalizeLabel(triageCard.label ?? row.dispositions[0]?.label),
          score: normalizeScore(triageCard.score)
        }
      };
    });

  const counts = signals.reduce(
    (acc, signal) => {
      acc.total += 1;
      if (!signal.disposition) {
        acc.pending += 1;
      } else {
        acc.processed += 1;
        if (signal.disposition === "FYI") acc.later += 1;
        if (signal.disposition === "DO") acc.do += 1;
        if (signal.disposition === "DROP") acc.drop += 1;
      }
      return acc;
    },
    {
      total: 0,
      pending: 0,
      processed: 0,
      later: 0,
      do: 0,
      drop: 0
    }
  );

  return {
    hasSnapshot: true,
    digest: {
      dateKey: snapshot.dateKey,
      count: signals.length,
      signals
    },
    counts,
    lastRefresh: parseRefreshStats(snapshot.refreshMetaJson),
    generatedAt: snapshot.updatedAt.toISOString(),
    legacyDigestRunExists: Boolean(run),
    legacyNotice: null
  };
}

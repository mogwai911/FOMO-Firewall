import { db } from "@/lib/db";
import { routeFeedsForDigest } from "@/lib/agent/feed-routing-agent";
import {
  DateWindowTimeZoneError,
  buildDateWindowForDateKey,
  shiftDateKeyByDays
} from "@/lib/time/date-window";

export type RoleV2 = "PM" | "ENG" | "RES";

export interface GenerateDigestInput {
  dateKey: string;
  limit?: number;
  role?: RoleV2;
  timezone?: string;
  windowDays?: number;
}

export interface DigestSignalItem {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  source: {
    id: string;
    name: string | null;
  };
  disposition: "FYI" | "DO" | "DROP" | null;
  triage: unknown;
  routing: {
    label: "FYI" | "DO" | "DROP";
    score: number;
  };
}

export interface DigestOutput {
  dateKey: string;
  count: number;
  signals: DigestSignalItem[];
}

interface SignalRow {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  source: {
    id: string;
    name: string | null;
    tagsJson: unknown;
    enabled: boolean;
  };
  dispositions: Array<{ label: "FYI" | "DO" | "DROP" }>;
  triages: Array<{ triageJson: unknown }>;
}

interface DigestDeps {
  listSignalsForDate: (start: Date, endExclusive: Date, limit: number) => Promise<SignalRow[]>;
  listSourceFeedback: (
    sourceIds: string[]
  ) => Promise<Record<string, { sessionEntered: number; sessionResumed: number; jobsRequested: number }>>;
}

export class DigestServiceError extends Error {
  code: "INVALID_DATE" | "INVALID_TIMEZONE" | "INVALID_WINDOW_DAYS";

  constructor(
    code: "INVALID_DATE" | "INVALID_TIMEZONE" | "INVALID_WINDOW_DAYS",
    message: string
  ) {
    super(message);
    this.code = code;
  }
}

function defaultDeps(): DigestDeps {
  return {
    listSignalsForDate: (start, endExclusive, limit) =>
      db.signal.findMany({
        where: {
          source: {
            enabled: true
          },
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
        },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: limit,
        select: {
          id: true,
          title: true,
          url: true,
          summary: true,
          publishedAt: true,
          createdAt: true,
          source: {
            select: {
              id: true,
              name: true,
              tagsJson: true,
              enabled: true
            }
          },
          dispositions: {
            select: { label: true }
          },
          triages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { triageJson: true }
          }
        }
      }),
    listSourceFeedback: async (sourceIds) => {
      if (sourceIds.length === 0) {
        return {};
      }
      const rows = await db.eventLogV2.findMany({
        where: {
          signal: {
            sourceId: {
              in: sourceIds
            }
          },
          type: {
            in: ["SESSION_ENTERED", "SESSION_RESUMED", "JOB_ENQUEUED"]
          }
        },
        select: {
          type: true,
          signal: {
            select: {
              sourceId: true
            }
          }
        }
      });
      return rows.reduce<Record<string, { sessionEntered: number; sessionResumed: number; jobsRequested: number }>>(
        (acc, row) => {
          const sourceId = row.signal?.sourceId;
          if (!sourceId) {
            return acc;
          }
          if (!acc[sourceId]) {
            acc[sourceId] = {
              sessionEntered: 0,
              sessionResumed: 0,
              jobsRequested: 0
            };
          }
          if (row.type === "SESSION_ENTERED") acc[sourceId].sessionEntered += 1;
          if (row.type === "SESSION_RESUMED") acc[sourceId].sessionResumed += 1;
          if (row.type === "JOB_ENQUEUED") acc[sourceId].jobsRequested += 1;
          return acc;
        },
        {}
      );
    }
  };
}

function toLower(input: string | null | undefined): string {
  return (input ?? "").toLowerCase();
}

function parseTriageScore(row: SignalRow): number {
  const triage = row.triages[0]?.triageJson;
  if (!triage || typeof triage !== "object") {
    return 0;
  }
  const score = (triage as { score?: unknown }).score;
  if (typeof score !== "number" || Number.isNaN(score)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function sourceCredibilityScore(row: SignalRow): number {
  const name = toLower(row.source.name);
  const tags = Array.isArray(row.source.tagsJson)
    ? row.source.tagsJson.map((tag) => String(tag).toLowerCase())
    : [];
  let score = 0;
  if (
    name.includes("official") ||
    name.includes("changelog") ||
    name.includes("docs") ||
    tags.includes("official") ||
    tags.includes("trusted")
  ) {
    score += 10;
  }
  if (name.includes("github") || name.includes("release")) {
    score += 4;
  }
  return score;
}

function rolePreferenceScore(row: SignalRow, role: RoleV2): number {
  const text = `${toLower(row.title)} ${toLower(row.summary)}`;
  const pmKeywords = ["roadmap", "launch", "pricing", "growth", "产品", "路线图", "交付"];
  const engKeywords = ["breaking", "deprecat", "migration", "security", "incident", "runtime", "api", "变更"];
  const resKeywords = ["paper", "benchmark", "study", "experiment", "evidence", "复现", "评测"];
  const hitCount = (keywords: string[]) => keywords.filter((token) => text.includes(token)).length;

  if (role === "PM") return hitCount(pmKeywords) * 4;
  if (role === "ENG") return hitCount(engKeywords) * 4;
  return hitCount(resKeywords) * 4;
}

function recencyScore(row: SignalRow, nowMs: number): number {
  const base = row.publishedAt ?? row.createdAt;
  const ageHours = Math.max(0, (nowMs - base.getTime()) / (1000 * 60 * 60));
  if (ageHours <= 2) return 12;
  if (ageHours <= 6) return 8;
  if (ageHours <= 12) return 5;
  if (ageHours <= 24) return 2;
  return 0;
}

function feedbackScore(
  sourceFeedback: { sessionEntered: number; sessionResumed: number; jobsRequested: number } | undefined
): number {
  if (!sourceFeedback) {
    return 0;
  }
  return (
    (sourceFeedback.sessionEntered ?? 0) * 4 +
    (sourceFeedback.sessionResumed ?? 0) * 2 +
    (sourceFeedback.jobsRequested ?? 0) * 3
  );
}

function computeRankingScore(
  row: SignalRow,
  role: RoleV2,
  sourceFeedback: { sessionEntered: number; sessionResumed: number; jobsRequested: number } | undefined,
  nowMs: number
): number {
  const triage = parseTriageScore(row);
  return (
    triage +
    sourceCredibilityScore(row) +
    rolePreferenceScore(row, role) +
    recencyScore(row, nowMs) +
    feedbackScore(sourceFeedback)
  );
}

function parseDateWindow(dateKey: string): { start: Date; endExclusive: Date } {
  return parseDateWindowWithTimezone(dateKey, "UTC");
}

function parseDateWindowWithTimezone(
  dateKey: string,
  timezone: string
): { start: Date; endExclusive: Date } {
  try {
    return buildDateWindowForDateKey(dateKey, timezone);
  } catch (error) {
    if (error instanceof DateWindowTimeZoneError) {
      throw new DigestServiceError(error.code, error.message);
    }
    throw error;
  }
}

function normalizeWindowDays(value: number | undefined): 1 | 3 | 7 {
  if (value === undefined) {
    return 1;
  }
  if (!Number.isFinite(value)) {
    throw new DigestServiceError("INVALID_WINDOW_DAYS", "windowDays must be 1, 3, or 7");
  }
  const rounded = Math.round(value);
  if (rounded === 1 || rounded === 3 || rounded === 7) {
    return rounded;
  }
  throw new DigestServiceError("INVALID_WINDOW_DAYS", "windowDays must be 1, 3, or 7");
}

export async function generateDigestForDate(
  input: GenerateDigestInput,
  deps: DigestDeps = defaultDeps()
): Promise<DigestOutput> {
  const timezone = input.timezone?.trim() || "UTC";
  const windowDays = normalizeWindowDays(input.windowDays);
  const startDateKey =
    windowDays > 1 ? shiftDateKeyByDays(input.dateKey, -(windowDays - 1)) : input.dateKey;
  const { start } = parseDateWindowWithTimezone(startDateKey, timezone);
  const { endExclusive } = parseDateWindowWithTimezone(input.dateKey, timezone);
  const limit = Math.max(1, Math.min(50, input.limit ?? 20));
  const role = input.role ?? "ENG";

  const candidateLimit = Math.max(limit, Math.min(200, limit * 3));
  const rows = await deps.listSignalsForDate(start, endExclusive, candidateLimit);
  const enabledRows = rows.filter((row) => row.source.enabled !== false);
  const sourceFeedbackMap = await deps.listSourceFeedback(
    Array.from(new Set(enabledRows.map((row) => row.source.id)))
  );
  const nowMs = Date.now();
  const rankedRows = enabledRows
    .map((row) => ({
      row,
      score: computeRankingScore(row, role, sourceFeedbackMap[row.source.id], nowMs)
    }));

  const routed = routeFeedsForDigest({
    role,
    limit,
    feeds: rankedRows.map(({ row, score }) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      sourceName: row.source.name,
      publishedAt: row.publishedAt?.toISOString() ?? row.createdAt.toISOString(),
      baseScore: score
    }))
  });

  const rowById = new Map(rankedRows.map((entry) => [entry.row.id, entry.row]));
  const signals: DigestSignalItem[] = [];
  for (const entry of routed.items) {
    const row = rowById.get(entry.id);
    if (!row) {
      continue;
    }
    const routing = routed.byId[entry.id];
    signals.push({
      id: row.id,
      title: row.title,
      url: row.url,
      summary: row.summary,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      source: row.source,
      disposition: row.dispositions[0]?.label ?? null,
      triage: row.triages[0]?.triageJson ?? null,
      routing: {
        label: routing?.label ?? "FYI",
        score: entry.rankScore
      }
    });
  }

  return {
    dateKey: input.dateKey,
    count: signals.length,
    signals
  };
}

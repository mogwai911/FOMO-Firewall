import { db } from "@/lib/db";
import type { DigestOutput } from "@/lib/services/digest-service";
import { generateDigestForDate } from "@/lib/services/digest-service";
import { ingestSignalsFromEnabledSources } from "@/lib/services/signal-ingest";

interface SchedulerSettings {
  schedule: {
    enabled: boolean;
    time: string;
    timezone: string;
  };
  lastScheduleRunAt: string | null;
}

interface SchedulerDeps {
  getSettings: () => Promise<SchedulerSettings>;
  runIngestion: () => Promise<unknown>;
  warmDigest: (input: { dateKey: string; timezone: string }) => Promise<DigestOutput>;
  markScheduleRun: (runAt: Date) => Promise<void>;
  upsertDigestRun: (input: { dateKey: string; signalCount: number; processedCount: number }) => Promise<void>;
}

export interface ScheduleTickResult {
  status: "SKIPPED_DISABLED" | "SKIPPED_NOT_DUE" | "SKIPPED_ALREADY_RAN" | "RAN";
  dateKey: string;
}

function formatLocalParts(date: Date, timezone: string): { dateKey: string; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  const parts = formatter.formatToParts(date);
  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = partMap.year ?? "1970";
  const month = partMap.month ?? "01";
  const day = partMap.day ?? "01";
  const hour = Number(partMap.hour ?? "0");
  const minute = Number(partMap.minute ?? "0");

  return {
    dateKey: `${year}-${month}-${day}`,
    hour,
    minute
  };
}

function parseScheduleMinutes(value: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }
  const [hourStr, minuteStr] = value.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

function defaultDeps(): SchedulerDeps {
  return {
    getSettings: async () => {
      const row = await db.appSettings.upsert({
        where: {
          id: "default"
        },
        create: {
          id: "default",
          scheduleEnabled: false,
          scheduleTime: "09:00",
          timezone: "UTC",
          apiBaseUrl: "",
          apiKey: ""
        },
        update: {}
      });
      return {
        schedule: {
          enabled: row.scheduleEnabled,
          time: row.scheduleTime,
          timezone: row.timezone || "UTC"
        },
        lastScheduleRunAt: row.lastScheduleRunAt?.toISOString() ?? null
      };
    },
    runIngestion: () => ingestSignalsFromEnabledSources(),
    warmDigest: ({ dateKey, timezone }) =>
      generateDigestForDate({
        dateKey,
        limit: 20,
        role: "ENG",
        timezone
      }),
    markScheduleRun: async (runAt) => {
      await db.appSettings.upsert({
        where: {
          id: "default"
        },
        create: {
          id: "default",
          lastScheduleRunAt: runAt
        },
        update: {
          lastScheduleRunAt: runAt
        }
      });
    },
    upsertDigestRun: async ({ dateKey, signalCount, processedCount }) => {
      await db.digestRun.upsert({
        where: {
          dateKey
        },
        create: {
          dateKey,
          mode: "SCHEDULED",
          signalCount,
          processedCount
        },
        update: {
          mode: "SCHEDULED",
          signalCount,
          processedCount
        }
      });
    }
  };
}

export async function runScheduledTick(
  input: { now?: Date; dueWindowMinutes?: number },
  deps: SchedulerDeps = defaultDeps()
): Promise<ScheduleTickResult> {
  const now = input.now ?? new Date();
  const dueWindowMinutes = input.dueWindowMinutes ?? 10;
  const settings = await deps.getSettings();
  const timezone = settings.schedule.timezone || "UTC";
  const nowLocal = formatLocalParts(now, timezone);

  if (!settings.schedule.enabled) {
    return {
      status: "SKIPPED_DISABLED",
      dateKey: nowLocal.dateKey
    };
  }

  const scheduleMinutes = parseScheduleMinutes(settings.schedule.time);
  if (scheduleMinutes === null) {
    return {
      status: "SKIPPED_NOT_DUE",
      dateKey: nowLocal.dateKey
    };
  }

  const nowMinutes = nowLocal.hour * 60 + nowLocal.minute;
  if (nowMinutes < scheduleMinutes || nowMinutes > scheduleMinutes + dueWindowMinutes) {
    return {
      status: "SKIPPED_NOT_DUE",
      dateKey: nowLocal.dateKey
    };
  }

  if (settings.lastScheduleRunAt) {
    const lastDateKey = formatLocalParts(new Date(settings.lastScheduleRunAt), timezone).dateKey;
    if (lastDateKey === nowLocal.dateKey) {
      return {
        status: "SKIPPED_ALREADY_RAN",
        dateKey: nowLocal.dateKey
      };
    }
  }

  await deps.runIngestion();
  const digest = await deps.warmDigest({ dateKey: nowLocal.dateKey, timezone });
  const processedCount = digest.signals.filter((signal) => signal.disposition !== null).length;
  await deps.upsertDigestRun({
    dateKey: nowLocal.dateKey,
    signalCount: digest.count,
    processedCount
  });
  await deps.markScheduleRun(now);

  return {
    status: "RAN",
    dateKey: nowLocal.dateKey
  };
}

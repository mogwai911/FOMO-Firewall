import { describe, expect, it, vi } from "vitest";
import { runScheduledTick } from "@/lib/services/scheduler-service";

describe("scheduler-service", () => {
  it("skips when schedule is disabled", async () => {
    const deps = {
      getSettings: vi.fn().mockResolvedValue({
        schedule: {
          enabled: false,
          time: "09:00",
          timezone: "UTC"
        },
        lastScheduleRunAt: null
      }),
      runIngestion: vi.fn(),
      warmDigest: vi.fn(),
      markScheduleRun: vi.fn(),
      upsertDigestRun: vi.fn()
    };

    const out = await runScheduledTick({ now: new Date("2026-02-20T09:00:00.000Z") }, deps as any);
    expect(out.status).toBe("SKIPPED_DISABLED");
    expect(deps.runIngestion).not.toHaveBeenCalled();
  });

  it("runs ingestion and digest when due", async () => {
    const deps = {
      getSettings: vi.fn().mockResolvedValue({
        schedule: {
          enabled: true,
          time: "09:00",
          timezone: "UTC"
        },
        lastScheduleRunAt: null
      }),
      runIngestion: vi.fn().mockResolvedValue({ createdSignals: 2 }),
      warmDigest: vi.fn().mockResolvedValue({ count: 2, signals: [] }),
      markScheduleRun: vi.fn(),
      upsertDigestRun: vi.fn()
    };

    const out = await runScheduledTick({ now: new Date("2026-02-20T09:03:00.000Z") }, deps as any);

    expect(out.status).toBe("RAN");
    expect(deps.runIngestion).toHaveBeenCalledTimes(1);
    expect(deps.warmDigest).toHaveBeenCalledWith({
      dateKey: "2026-02-20",
      timezone: "UTC"
    });
    expect(deps.upsertDigestRun).toHaveBeenCalledWith({
      dateKey: "2026-02-20",
      signalCount: 2,
      processedCount: 0
    });
    expect(deps.markScheduleRun).toHaveBeenCalled();
  });

  it("skips when already ran for the same local day", async () => {
    const deps = {
      getSettings: vi.fn().mockResolvedValue({
        schedule: {
          enabled: true,
          time: "09:00",
          timezone: "UTC"
        },
        lastScheduleRunAt: "2026-02-20T09:05:00.000Z"
      }),
      runIngestion: vi.fn(),
      warmDigest: vi.fn(),
      markScheduleRun: vi.fn(),
      upsertDigestRun: vi.fn()
    };

    const out = await runScheduledTick({ now: new Date("2026-02-20T09:10:00.000Z") }, deps as any);
    expect(out.status).toBe("SKIPPED_ALREADY_RAN");
    expect(deps.runIngestion).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  runScheduleTickRequest,
  shouldRunScheduleTick
} from "@/components/scheduler-heartbeat";

describe("scheduler-heartbeat helpers", () => {
  it("runs tick request with expected endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const ok = await runScheduleTickRequest(fetchMock as any);

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/jobs/schedule_tick", {
      method: "POST"
    });
  });

  it("skips tick when document is hidden", () => {
    expect(shouldRunScheduleTick({ visibilityState: "hidden" } as any)).toBe(false);
    expect(shouldRunScheduleTick({ visibilityState: "visible" } as any)).toBe(true);
  });
});

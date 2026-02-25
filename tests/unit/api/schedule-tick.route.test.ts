import { describe, expect, it, vi } from "vitest";
import { createScheduleTickPostHandler } from "@/app/api/jobs/schedule_tick/route";

describe("schedule tick route", () => {
  it("runs schedule tick", async () => {
    const runTick = vi.fn().mockResolvedValue({
      status: "RAN"
    });
    const handler = createScheduleTickPostHandler({ runTick } as any);

    const res = await handler();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(runTick).toHaveBeenCalledTimes(1);
    expect(json.status).toBe("RAN");
  });
});

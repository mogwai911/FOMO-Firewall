import { describe, expect, it, vi } from "vitest";
import { createJobQueueDispatcher } from "@/lib/services/job-queue";

describe("job-queue", () => {
  it("dispatches queued job asynchronously", async () => {
    const runJob = vi.fn().mockResolvedValue(undefined);
    const schedule = vi.fn((callback: () => void) => {
      callback();
      return 1 as unknown as ReturnType<typeof setTimeout>;
    });

    const dispatcher = createJobQueueDispatcher({ runJob, schedule });
    dispatcher.dispatch("job-1");

    expect(schedule).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(runJob).toHaveBeenCalledWith("job-1");
  });

  it("deduplicates in-flight job dispatch requests", async () => {
    const runJob = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const scheduledCallbacks: Array<() => void> = [];
    const schedule = vi.fn((callback: () => void) => {
      scheduledCallbacks.push(callback);
      return 1 as unknown as ReturnType<typeof setTimeout>;
    });

    const dispatcher = createJobQueueDispatcher({ runJob, schedule });
    dispatcher.dispatch("job-1");
    dispatcher.dispatch("job-1");

    expect(schedule).toHaveBeenCalledTimes(1);

    const callback = scheduledCallbacks[0];
    callback();
    await Promise.resolve();
    expect(runJob).toHaveBeenCalledTimes(1);
  });
});

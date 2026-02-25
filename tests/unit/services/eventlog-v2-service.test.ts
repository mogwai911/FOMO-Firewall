import { describe, expect, it, vi } from "vitest";
import {
  EventLogServiceError,
  isEventTypeV2,
  recordEventV2,
  summarizeSignalFeedback
} from "@/lib/services/eventlog-v2-service";

describe("eventlog-v2-service", () => {
  it("validates event types", () => {
    expect(isEventTypeV2("DISPOSITION_SET")).toBe(true);
    expect(isEventTypeV2("SESSION_ENTERED")).toBe(true);
    expect(isEventTypeV2("JOB_ENQUEUED")).toBe(true);
    expect(isEventTypeV2("UNKNOWN")).toBe(false);
  });

  it("records event with normalized timestamp", async () => {
    const deps = {
      createEvent: vi.fn().mockResolvedValue({
        id: "evt-1",
        type: "DISPOSITION_SET",
        signalId: "sig-1",
        sessionId: null,
        jobId: null,
        payloadJson: { label: "DO" },
        createdAt: new Date("2026-02-20T09:00:00.000Z")
      })
    };

    const out = await recordEventV2(
      {
        type: "DISPOSITION_SET",
        signalId: "sig-1",
        payloadJson: { label: "DO" }
      },
      deps as any
    );

    expect(deps.createEvent).toHaveBeenCalledWith({
      type: "DISPOSITION_SET",
      signalId: "sig-1",
      sessionId: undefined,
      jobId: undefined,
      payloadJson: { label: "DO" }
    });
    expect(out.createdAt).toBe("2026-02-20T09:00:00.000Z");
  });

  it("throws INVALID_EVENT_TYPE for invalid type", async () => {
    const deps = {
      createEvent: vi.fn()
    };

    await expect(
      recordEventV2(
        {
          type: "UNKNOWN" as any
        },
        deps as any
      )
    ).rejects.toMatchObject({ code: "INVALID_EVENT_TYPE" } as EventLogServiceError);
  });

  it("summarizes event feedback by signal", () => {
    const out = summarizeSignalFeedback([
      {
        type: "DISPOSITION_SET",
        signalId: "sig-1"
      },
      {
        type: "DISPOSITION_CHANGED",
        signalId: "sig-1"
      },
      {
        type: "SESSION_ENTERED",
        signalId: "sig-1"
      },
      {
        type: "JOB_ENQUEUED",
        signalId: "sig-2"
      }
    ]);

    expect(out["sig-1"]).toMatchObject({
      dispositionSet: 1,
      dispositionChanged: 1,
      sessionEntered: 1
    });
    expect(out["sig-2"]).toMatchObject({
      jobsRequested: 1
    });
  });
});

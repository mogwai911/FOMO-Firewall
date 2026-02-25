import { describe, expect, it, vi } from "vitest";
import {
  deleteInsightCardById,
  enqueueJob,
  isValidJobType,
  JobServiceError,
  listEvidencePacks,
  listInsightCards
} from "@/lib/services/job-service";

describe("job-service", () => {
  it("validates job type", () => {
    expect(isValidJobType("INSIGHT_CARD")).toBe(true);
    expect(isValidJobType("EVIDENCE_PACK")).toBe(true);
    expect(isValidJobType("OTHER")).toBe(false);
  });

  it("throws SESSION_NOT_FOUND when enqueue target does not exist", async () => {
    const deps = {
      findSession: vi.fn().mockResolvedValue(null),
      createJob: vi.fn(),
      listInsightCards: vi.fn(),
      listEvidencePacks: vi.fn(),
      recordEvent: vi.fn()
    };

    await expect(
      enqueueJob(
        {
          sessionId: "missing",
          type: "INSIGHT_CARD"
        },
        deps as any
      )
    ).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" } as JobServiceError);
  });

  it("enqueues job and maps timestamps", async () => {
    const deps = {
      findSession: vi.fn().mockResolvedValue({ id: "session-1", signalId: "sig-1" }),
      createJob: vi.fn().mockResolvedValue({
        id: "job-1",
        sessionId: "session-1",
        type: "INSIGHT_CARD",
        status: "QUEUED",
        error: null,
        resultRefJson: null,
        createdAt: new Date("2026-02-20T02:00:00.000Z"),
        updatedAt: new Date("2026-02-20T02:00:00.000Z")
      }),
      listInsightCards: vi.fn(),
      listEvidencePacks: vi.fn(),
      recordEvent: vi.fn()
    };

    const out = await enqueueJob(
      {
        sessionId: "session-1",
        type: "INSIGHT_CARD"
      },
      deps as any
    );

    expect(deps.createJob).toHaveBeenCalledWith({
      sessionId: "session-1",
      type: "INSIGHT_CARD"
    });
    expect(deps.recordEvent).toHaveBeenCalledWith({
      type: "JOB_ENQUEUED",
      signalId: "sig-1",
      sessionId: "session-1",
      jobId: "job-1",
      payloadJson: {
        type: "INSIGHT_CARD"
      }
    });
    expect(out.id).toBe("job-1");
    expect(out.createdAt).toBe("2026-02-20T02:00:00.000Z");
  });

  it("clamps list limits for cards and packs", async () => {
    const deps = {
      findSession: vi.fn(),
      createJob: vi.fn(),
      listInsightCards: vi.fn().mockResolvedValue([]),
      listEvidencePacks: vi.fn().mockResolvedValue([]),
      recordEvent: vi.fn()
    };

    await listInsightCards({ sessionId: "session-1", limit: 999 }, deps as any);
    await listEvidencePacks({ sessionId: "session-1", limit: 0 }, deps as any);

    expect(deps.listInsightCards).toHaveBeenCalledWith({
      sessionId: "session-1",
      limit: 200
    });
    expect(deps.listEvidencePacks).toHaveBeenCalledWith({
      sessionId: "session-1",
      limit: 50
    });
  });

  it("deletes insight card by id", async () => {
    const deps = {
      findSession: vi.fn(),
      createJob: vi.fn(),
      listInsightCards: vi.fn(),
      listEvidencePacks: vi.fn(),
      findInsightCardRef: vi.fn().mockResolvedValue({ id: "card-1" }),
      deleteInsightCard: vi.fn().mockResolvedValue({ id: "card-1" }),
      recordEvent: vi.fn()
    };

    const deleted = await deleteInsightCardById("card-1", deps as any);

    expect(deps.findInsightCardRef).toHaveBeenCalledWith("card-1");
    expect(deps.deleteInsightCard).toHaveBeenCalledWith("card-1");
    expect(deleted.id).toBe("card-1");
  });

  it("throws INSIGHT_CARD_NOT_FOUND when deleting missing card", async () => {
    const deps = {
      findSession: vi.fn(),
      createJob: vi.fn(),
      listInsightCards: vi.fn(),
      listEvidencePacks: vi.fn(),
      findInsightCardRef: vi.fn().mockResolvedValue(null),
      deleteInsightCard: vi.fn(),
      recordEvent: vi.fn()
    };

    await expect(deleteInsightCardById("missing", deps as any)).rejects.toMatchObject({
      code: "INSIGHT_CARD_NOT_FOUND"
    } as JobServiceError);
    expect(deps.deleteInsightCard).not.toHaveBeenCalled();
  });
});

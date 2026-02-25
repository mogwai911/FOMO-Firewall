import { describe, expect, it, vi } from "vitest";
import { processJobById } from "@/lib/services/job-worker";

describe("job-worker v2", () => {
  it("processes INSIGHT_CARD job into DONE with insight card refs", async () => {
    const getJob = vi.fn().mockResolvedValue({
      id: "job-1",
      type: "INSIGHT_CARD",
      status: "QUEUED",
      sessionId: "session-1",
      session: {
        signalId: "sig-1",
        messages: [
          { role: "USER", content: "如何快速验证这条线索？" },
          { role: "ASSISTANT", content: "先做最小实验并记录结果。" }
        ],
        signal: {
          title: "OpenAI 更新",
          summary: "更新说明"
        }
      }
    });
    const setJobRunning = vi.fn().mockResolvedValue(undefined);
    const setJobDone = vi.fn().mockResolvedValue({
      id: "job-1",
      status: "DONE",
      resultRefJson: { insightCardIds: ["card-1"] }
    });
    const setJobFailed = vi.fn();
    const createInsightCards = vi.fn().mockResolvedValue(["card-1"]);
    const createEvidencePack = vi.fn();

    const out = await processJobById("job-1", {
      getJob,
      setJobRunning,
      setJobDone,
      setJobFailed,
      createInsightCards,
      createEvidencePack
    } as any);

    expect(setJobRunning).toHaveBeenCalledWith("job-1");
    expect(createInsightCards).toHaveBeenCalledWith(
      "session-1",
      "sig-1",
      [
        { role: "USER", content: "如何快速验证这条线索？" },
        { role: "ASSISTANT", content: "先做最小实验并记录结果。" }
      ],
      "OpenAI 更新",
      "更新说明"
    );
    expect(createEvidencePack).not.toHaveBeenCalled();
    expect(setJobDone).toHaveBeenCalledWith("job-1", { insightCardIds: ["card-1"] });
    expect(out.status).toBe("DONE");
  });
});

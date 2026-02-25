import { describe, expect, it } from "vitest";
import {
  DispositionLabel,
  JobStatusV2,
  JobTypeV2,
  SessionStatusV2
} from "@/lib/domain/v2-enums";

describe("v2 domain enums", () => {
  it("exposes required v2 labels and statuses", () => {
    expect(DispositionLabel.FYI).toBe("FYI");
    expect(DispositionLabel.DO).toBe("DO");
    expect(DispositionLabel.DROP).toBe("DROP");

    expect(SessionStatusV2.ACTIVE).toBe("ACTIVE");
    expect(SessionStatusV2.PAUSED).toBe("PAUSED");
    expect(SessionStatusV2.CLOSED).toBe("CLOSED");

    expect(JobTypeV2.INSIGHT_CARD).toBe("INSIGHT_CARD");
    expect(JobTypeV2.EVIDENCE_PACK).toBe("EVIDENCE_PACK");

    expect(JobStatusV2.QUEUED).toBe("QUEUED");
    expect(JobStatusV2.RUNNING).toBe("RUNNING");
    expect(JobStatusV2.DONE).toBe("DONE");
    expect(JobStatusV2.FAILED).toBe("FAILED");
  });
});

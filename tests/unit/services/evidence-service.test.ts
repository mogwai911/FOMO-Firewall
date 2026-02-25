import { describe, expect, it, vi } from "vitest";
import { EvidenceServiceError, getEvidencePackDetail } from "@/lib/services/evidence-service";

describe("evidence-service", () => {
  it("returns evidence detail with transcript", async () => {
    const deps = {
      findEvidenceById: vi.fn().mockResolvedValue({
        id: "pack-1",
        sessionId: "session-1",
        signalId: "sig-1",
        createdAt: new Date("2026-02-20T00:00:00.000Z"),
        packJson: {
          summary: "summary",
          key_quotes: [],
          links: [],
          trace: {
            signal_id: "sig-1",
            session_id: "session-1"
          }
        },
        session: {
          messages: [
            {
              id: "msg-1",
              role: "USER",
              content: "hello",
              createdAt: new Date("2026-02-20T00:10:00.000Z")
            }
          ]
        }
      })
    };

    const out = await getEvidencePackDetail("pack-1", deps as any);
    expect(out.id).toBe("pack-1");
    expect(out.sessionAvailable).toBe(true);
    expect(out.transcript).toHaveLength(1);
  });

  it("marks session trace unavailable when session has been deleted", async () => {
    const deps = {
      findEvidenceById: vi.fn().mockResolvedValue({
        id: "pack-2",
        sessionId: null,
        signalId: "sig-2",
        createdAt: new Date("2026-02-20T00:00:00.000Z"),
        packJson: {
          summary: "summary"
        },
        session: null
      })
    };

    const out = await getEvidencePackDetail("pack-2", deps as any);
    expect(out.sessionAvailable).toBe(false);
    expect(out.sessionId).toBeNull();
    expect(out.transcript).toHaveLength(0);
  });

  it("throws EVIDENCE_NOT_FOUND when missing", async () => {
    const deps = {
      findEvidenceById: vi.fn().mockResolvedValue(null)
    };

    await expect(getEvidencePackDetail("missing", deps as any)).rejects.toMatchObject({
      code: "EVIDENCE_NOT_FOUND"
    } as EvidenceServiceError);
  });
});

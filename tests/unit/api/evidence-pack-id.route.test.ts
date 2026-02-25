import { describe, expect, it, vi } from "vitest";
import { createEvidencePackGetHandler } from "@/app/api/evidence_packs/[id]/route";

describe("evidence pack detail route", () => {
  it("GET /api/evidence_packs/:id forwards id", async () => {
    const getPack = vi.fn().mockResolvedValue({
      id: "pack-1",
      summary: "summary",
      transcript: []
    });
    const handler = createEvidencePackGetHandler({ getPack } as any);
    const req = new Request("http://localhost/api/evidence_packs/pack-1");

    const res = await handler(req, { params: Promise.resolve({ id: "pack-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(getPack).toHaveBeenCalledWith("pack-1");
    expect(json.pack.id).toBe("pack-1");
  });
});

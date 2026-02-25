import { describe, expect, it, vi } from "vitest";
import { createInsightCardDeleteHandler } from "@/app/api/insight_cards/[id]/route";
import { JobServiceError } from "@/lib/services/job-service";

describe("DELETE /api/insight_cards/:id", () => {
  it("deletes insight card by id", async () => {
    const deleteInsightCardById = vi.fn().mockResolvedValue({ id: "card-1" });
    const handler = createInsightCardDeleteHandler({ deleteInsightCardById } as any);

    const res = await handler(
      new Request("http://localhost/api/insight_cards/card-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "card-1" }) }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(deleteInsightCardById).toHaveBeenCalledWith("card-1");
    expect(json.deleted.id).toBe("card-1");
  });

  it("returns 404 when card does not exist", async () => {
    const deleteInsightCardById = vi
      .fn()
      .mockRejectedValue(new JobServiceError("INSIGHT_CARD_NOT_FOUND", "missing"));
    const handler = createInsightCardDeleteHandler({ deleteInsightCardById } as any);

    const res = await handler(
      new Request("http://localhost/api/insight_cards/missing", { method: "DELETE" }),
      { params: Promise.resolve({ id: "missing" }) }
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("INSIGHT_CARD_NOT_FOUND");
  });
});

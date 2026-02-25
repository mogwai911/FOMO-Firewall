import { describe, expect, it, vi } from "vitest";
import { createRssFetchPostHandler } from "@/app/api/jobs/rss_fetch/route";

describe("POST /api/jobs/rss_fetch", () => {
  it("returns ingestion summary", async () => {
    const runIngestion = vi.fn().mockResolvedValue({
      sources: 2,
      signals: 5,
      duplicates: 1,
      errors: []
    });

    const handler = createRssFetchPostHandler({ runIngestion } as any);
    const res = await handler();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      ok: true,
      summary: {
        sources: 2,
        signals: 5,
        duplicates: 1,
        errors: []
      }
    });
    expect(runIngestion).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when ingestion throws", async () => {
    const runIngestion = vi.fn().mockRejectedValue(new Error("boom"));
    const handler = createRssFetchPostHandler({ runIngestion } as any);

    const res = await handler();
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("RSS_FETCH_FAILED");
  });
});

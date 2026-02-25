import { describe, expect, it, vi } from "vitest";
import { createDigestViewGetHandler } from "@/app/api/digest/[date]/route";

describe("digest view route", () => {
  it("GET /api/digest/:date forwards windowDays as read-only query", async () => {
    const getDigestView = vi.fn().mockResolvedValue({
      hasSnapshot: true,
      digest: {
        dateKey: "2026-02-22",
        count: 2,
        signals: []
      },
      counts: {
        total: 2,
        pending: 1,
        processed: 1,
        later: 1,
        do: 0,
        drop: 0
      },
      lastRefresh: null,
      generatedAt: "2026-02-22T10:00:00.000Z",
      legacyDigestRunExists: false,
      legacyNotice: null
    });
    const handler = createDigestViewGetHandler({ getDigestView } as any);

    const res = await handler(
      new Request("http://localhost/api/digest/2026-02-22?windowDays=7"),
      { params: Promise.resolve({ date: "2026-02-22" }) }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(getDigestView).toHaveBeenCalledWith({
      dateKey: "2026-02-22",
      windowDays: 7
    });
    expect(json.hasSnapshot).toBe(true);
    expect(json.counts.total).toBe(2);
  });

  it("returns 400 for invalid windowDays query", async () => {
    const getDigestView = vi.fn();
    const handler = createDigestViewGetHandler({ getDigestView } as any);

    const res = await handler(
      new Request("http://localhost/api/digest/2026-02-22?windowDays=5"),
      { params: Promise.resolve({ date: "2026-02-22" }) }
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_WINDOW_DAYS");
    expect(getDigestView).not.toHaveBeenCalled();
  });
});

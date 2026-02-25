import { afterEach, describe, expect, it, vi } from "vitest";
import { manualRefreshDigest } from "@/lib/client/app-api";

describe("digest refresh api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends keepalive option without leaking it into request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: {
            hasDigest: true,
            generatedAt: "2026-02-25T10:00:00.000Z",
            signalCount: 1,
            processedCount: 0
          },
          digest: {
            dateKey: "2026-02-25",
            count: 1,
            signals: []
          },
          ingestionSummary: {
            sources: 1,
            signals: 1,
            duplicates: 0,
            errors: []
          },
          triageSummary: {
            requested: 0,
            generated: 0,
            failed: 0,
            errors: []
          }
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await manualRefreshDigest({
      dateKey: "2026-02-25",
      windowDays: 7,
      limit: 100,
      keepalive: true
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.keepalive).toBe(true);
    const payload = JSON.parse(String(init.body));
    expect(payload.keepalive).toBeUndefined();
    expect(payload.windowDays).toBe(7);
    expect(payload.limit).toBe(100);
  });
});


import { describe, expect, it, vi } from "vitest";
import {
  createDigestManualRefreshPostHandler
} from "@/app/api/digest/[date]/manual-refresh/route";
import { createDigestStatusGetHandler } from "@/app/api/digest/[date]/status/route";
import { DigestManualRefreshServiceError } from "@/lib/services/digest-manual-refresh-service";

describe("digest manual refresh routes", () => {
  it("GET /api/digest/:date/status returns status payload", async () => {
    const getStatus = vi.fn().mockResolvedValue({
      hasDigest: true,
      generatedAt: "2026-02-21T09:30:00.000Z",
      signalCount: 8,
      processedCount: 3
    });
    const handler = createDigestStatusGetHandler({ getStatus } as any);

    const res = await handler(new Request("http://localhost?windowDays=7"), {
      params: Promise.resolve({ date: "2026-02-21" })
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status.hasDigest).toBe(true);
    expect(getStatus).toHaveBeenCalledWith({ dateKey: "2026-02-21", windowDays: 7 });
  });

  it("GET /api/digest/:date/status validates windowDays", async () => {
    const getStatus = vi.fn();
    const handler = createDigestStatusGetHandler({ getStatus } as any);

    const res = await handler(new Request("http://localhost?windowDays=5"), {
      params: Promise.resolve({ date: "2026-02-21" })
    });

    expect(res.status).toBe(400);
    expect(getStatus).not.toHaveBeenCalled();
  });

  it("POST /api/digest/:date/manual-refresh validates resetMode", async () => {
    const manualRefresh = vi.fn();
    const handler = createDigestManualRefreshPostHandler({ manualRefresh } as any);

    const res = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ overwrite: true, resetMode: "INVALID" })
      }),
      {
        params: Promise.resolve({ date: "2026-02-21" })
      }
    );

    expect(res.status).toBe(400);
    expect(manualRefresh).not.toHaveBeenCalled();
  });

  it("POST /api/digest/:date/manual-refresh validates timezone", async () => {
    const manualRefresh = vi.fn();
    const handler = createDigestManualRefreshPostHandler({ manualRefresh } as any);

    const res = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ overwrite: true, timezone: "Mars/Phobos" })
      }),
      {
        params: Promise.resolve({ date: "2026-02-21" })
      }
    );

    expect(res.status).toBe(400);
    expect(manualRefresh).not.toHaveBeenCalled();
  });

  it("POST /api/digest/:date/manual-refresh validates windowDays", async () => {
    const manualRefresh = vi.fn();
    const handler = createDigestManualRefreshPostHandler({ manualRefresh } as any);

    const res = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ windowDays: 5 })
      }),
      {
        params: Promise.resolve({ date: "2026-02-21" })
      }
    );

    expect(res.status).toBe(400);
    expect(manualRefresh).not.toHaveBeenCalled();
  });

  it("POST /api/digest/:date/manual-refresh validates limit", async () => {
    const manualRefresh = vi.fn();
    const handler = createDigestManualRefreshPostHandler({ manualRefresh } as any);

    const res = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 0 })
      }),
      {
        params: Promise.resolve({ date: "2026-02-21" })
      }
    );

    expect(res.status).toBe(400);
    expect(manualRefresh).not.toHaveBeenCalled();
  });

  it("POST /api/digest/:date/manual-refresh maps digest exists error to 409", async () => {
    const manualRefresh = vi
      .fn()
      .mockRejectedValue(
        new DigestManualRefreshServiceError("DIGEST_ALREADY_EXISTS", "digest exists")
      );
    const handler = createDigestManualRefreshPostHandler({ manualRefresh } as any);

    const res = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ overwrite: false })
      }),
      {
        params: Promise.resolve({ date: "2026-02-21" })
      }
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("DIGEST_ALREADY_EXISTS");
  });

  it("POST /api/digest/:date/manual-refresh returns digest payload", async () => {
    const manualRefresh = vi.fn().mockResolvedValue({
      status: {
        hasDigest: true,
        generatedAt: "2026-02-21T09:30:00.000Z",
        signalCount: 8,
        processedCount: 1
      },
      digest: {
        dateKey: "2026-02-21",
        count: 8,
        signals: []
      },
      ingestionSummary: {
        sources: 2,
        signals: 3,
        duplicates: 0,
        errors: []
      }
    });
    const handler = createDigestManualRefreshPostHandler({ manualRefresh } as any);

    const res = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            overwrite: true,
            resetMode: "PRESERVE_DISPOSITIONS",
            windowDays: 7,
            limit: 88
          })
      }),
      {
        params: Promise.resolve({ date: "2026-02-21" })
      }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.digest.count).toBe(8);
    expect(manualRefresh).toHaveBeenCalledWith({
      dateKey: "2026-02-21",
      overwrite: true,
      resetMode: "PRESERVE_DISPOSITIONS",
      role: undefined,
      timezone: undefined,
      windowDays: 7,
      limit: 88
    });
  });
});

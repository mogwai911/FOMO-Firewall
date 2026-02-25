import { describe, expect, it, vi } from "vitest";
import { listFyiSignals, SignalFyiServiceError } from "@/lib/services/fyi-service";

describe("fyi-service", () => {
  it("lists FYI signals ordered by latest disposition update", async () => {
    const deps = {
      listByDisposition: vi.fn().mockResolvedValue([
        {
          signal: {
            id: "sig-2",
            title: "FYI 2",
            url: "https://example.com/2",
            summary: "second",
            publishedAt: new Date("2026-02-20T08:00:00.000Z"),
            source: {
              id: "src-1",
              name: "Feed"
            }
          },
          updatedAt: new Date("2026-02-20T10:00:00.000Z")
        },
        {
          signal: {
            id: "sig-1",
            title: "FYI 1",
            url: "https://example.com/1",
            summary: "first",
            publishedAt: null,
            source: {
              id: "src-1",
              name: "Feed"
            }
          },
          updatedAt: new Date("2026-02-20T09:00:00.000Z")
        }
      ])
    };

    const out = await listFyiSignals({ limit: 10 }, deps as any);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe("sig-2");
    expect(out[0].dispositionUpdatedAt).toBe("2026-02-20T10:00:00.000Z");
  });

  it("throws invalid limit error", async () => {
    const deps = {
      listByDisposition: vi.fn()
    };
    await expect(listFyiSignals({ limit: 0 }, deps as any)).rejects.toMatchObject({
      code: "INVALID_LIMIT"
    } as SignalFyiServiceError);
  });
});

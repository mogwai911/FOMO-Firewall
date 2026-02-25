import { describe, expect, it } from "vitest";
import { IngestCache } from "@/lib/services/ingest-cache";

describe("IngestCache", () => {
  it("returns cache within source interval and within ttl", () => {
    const cache = new IngestCache({ ttlMs: 1_000 });
    const now = 1_000;

    cache.set("k1", { extractedText: "abc" }, { sourceIntervalMs: 300, now });

    const hitInInterval = cache.get("k1", { now: 1_200 });
    const hitInTtl = cache.get("k1", { now: 1_700 });
    const expired = cache.get("k1", { now: 2_100 });

    expect(hitInInterval?.cacheStatus).toBe("INTERVAL");
    expect(hitInTtl?.cacheStatus).toBe("TTL");
    expect(expired).toBeUndefined();
  });
});

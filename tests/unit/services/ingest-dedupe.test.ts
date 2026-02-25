import { describe, expect, it } from "vitest";
import {
  buildContentHash,
  findExistingItemByFingerprint,
  type IngestDedupeStore
} from "@/lib/services/ingest-dedupe";

describe("ingest dedupe", () => {
  it("prefers normalizedUrl match", async () => {
    const store: IngestDedupeStore = {
      findByNormalizedUrl: async () => ({ id: "item-url" }),
      findByContentHash: async () => ({ id: "item-hash" })
    };

    const found = await findExistingItemByFingerprint(store, {
      normalizedUrl: "https://example.com/a",
      contentHash: "hash"
    });

    expect(found?.id).toBe("item-url");
  });

  it("falls back to content hash match", async () => {
    const store: IngestDedupeStore = {
      findByNormalizedUrl: async () => null,
      findByContentHash: async () => ({ id: "item-hash" })
    };

    const found = await findExistingItemByFingerprint(store, {
      normalizedUrl: "https://example.com/a",
      contentHash: "hash"
    });

    expect(found?.id).toBe("item-hash");
  });

  it("returns null when no fingerprint match", async () => {
    const store: IngestDedupeStore = {
      findByNormalizedUrl: async () => null,
      findByContentHash: async () => null
    };

    const found = await findExistingItemByFingerprint(store, {
      normalizedUrl: "https://example.com/a",
      contentHash: "hash"
    });

    expect(found).toBeNull();
  });

  it("builds deterministic content hash", () => {
    const a = buildContentHash("same text");
    const b = buildContentHash("same text");
    const c = buildContentHash("other text");

    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

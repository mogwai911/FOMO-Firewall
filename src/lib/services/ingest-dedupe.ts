import { createHash } from "node:crypto";

export interface IngestDedupeStore {
  findByNormalizedUrl(normalizedUrl: string): Promise<{ id: string } | null>;
  findByContentHash(contentHash: string): Promise<{ id: string } | null>;
}

export interface DedupeFingerprint {
  normalizedUrl?: string;
  contentHash: string;
}

export function buildContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function findExistingItemByFingerprint(
  store: IngestDedupeStore,
  fingerprint: DedupeFingerprint
): Promise<{ id: string } | null> {
  if (fingerprint.normalizedUrl) {
    const byUrl = await store.findByNormalizedUrl(fingerprint.normalizedUrl);
    if (byUrl) {
      return byUrl;
    }
  }

  return store.findByContentHash(fingerprint.contentHash);
}

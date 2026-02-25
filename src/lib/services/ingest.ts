import type { PrismaClient } from "@prisma/client";
import { resolveAndNormalizeCollectInput } from "@/lib/collect/registry";
import type { CollectInput, IngestionFailureCode, SourceType } from "@/lib/collect/types";
import { db } from "@/lib/db";
import { IngestCache } from "@/lib/services/ingest-cache";
import { buildContentHash, findExistingItemByFingerprint } from "@/lib/services/ingest-dedupe";
import { classifyIngestionFailure } from "@/lib/services/ingest-failure";
import { extractReadableContent, type ReadabilityExtractResult } from "@/lib/services/readability";

export interface IngestResult {
  itemId: string;
  reused: boolean;
}

export class IngestionError extends Error {
  readonly code: IngestionFailureCode;

  constructor(code: IngestionFailureCode, message: string) {
    super(message);
    this.code = code;
    this.name = "IngestionError";
  }
}

interface IngestDeps {
  db: PrismaClient;
  fetchFn: typeof fetch;
  now: () => number;
  cache: IngestCache<ReadabilityExtractResult>;
}

const defaultCache = new IngestCache<ReadabilityExtractResult>({
  ttlMs: 30 * 60 * 1000
});

const defaultDeps: IngestDeps = {
  db,
  fetchFn: fetch,
  now: () => Date.now(),
  cache: defaultCache
};

async function logIngestionAttempt(
  prisma: PrismaClient,
  input: {
    itemId?: string;
    sourceType: SourceType;
    status: "SUCCESS" | "FAILED";
    failureCode?: IngestionFailureCode;
    latencyMs: number;
  }
): Promise<void> {
  await prisma.ingestionAttempt.create({
    data: {
      itemId: input.itemId,
      sourceType: input.sourceType,
      status: input.status,
      failureCode: input.failureCode,
      latencyMs: input.latencyMs
    }
  });
}

export async function ingestItem(input: CollectInput, deps: IngestDeps = defaultDeps): Promise<IngestResult> {
  const startedAt = deps.now();
  let sourceType: SourceType = "TEXT";

  try {
    const normalized = resolveAndNormalizeCollectInput(input);
    sourceType = normalized.sourceType;

    let normalizedUrl: string | undefined;
    let title: string | undefined;
    let author: string | undefined;
    let publishedAt: Date | undefined;
    let extractedText: string;

    if (normalized.sourceType === "URL") {
      if (!normalized.url) {
        throw new Error("Normalized URL is required for URL source");
      }
      const normalizedUrlForCache = normalized.url;
      normalizedUrl = normalizedUrlForCache;
      const cacheHit = deps.cache.get(normalizedUrlForCache, { now: deps.now() });
      let extracted: ReadabilityExtractResult;

      if (cacheHit) {
        extracted = cacheHit.value;
      } else {
        const response = await deps.fetchFn(normalizedUrlForCache);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} fetch blocked`);
        }

        const html = await response.text();
        extracted = extractReadableContent(html);
        deps.cache.set(normalizedUrlForCache, extracted, {
          sourceIntervalMs: 2 * 60 * 1000,
          now: deps.now()
        });
      }

      extractedText = extracted.extractedText;
      title = extracted.title;
      author = extracted.author;
      publishedAt = extracted.publishedAt;
    } else {
      extractedText = normalized.text!;
    }

    const contentHash = buildContentHash(extractedText);
    const existing = await findExistingItemByFingerprint(
      {
        findByNormalizedUrl: async (url) =>
          deps.db.item.findFirst({ where: { normalizedUrl: url }, select: { id: true } }),
        findByContentHash: async (hash) =>
          deps.db.item.findFirst({ where: { contentHash: hash }, select: { id: true } })
      },
      {
        normalizedUrl,
        contentHash
      }
    );

    if (existing) {
      await logIngestionAttempt(deps.db, {
        itemId: existing.id,
        sourceType,
        status: "SUCCESS",
        latencyMs: deps.now() - startedAt
      });
      return { itemId: existing.id, reused: true };
    }

    const created = await deps.db.item.create({
      data: {
        url: normalizedUrl,
        normalizedUrl,
        title,
        author,
        publishedAt,
        extractedText,
        contentHash,
        status: "NEW"
      },
      select: { id: true }
    });

    await logIngestionAttempt(deps.db, {
      itemId: created.id,
      sourceType,
      status: "SUCCESS",
      latencyMs: deps.now() - startedAt
    });

    return { itemId: created.id, reused: false };
  } catch (error) {
    const failureCode = classifyIngestionFailure(error);
    await logIngestionAttempt(deps.db, {
      sourceType,
      status: "FAILED",
      failureCode,
      latencyMs: deps.now() - startedAt
    });

    const message = error instanceof Error ? error.message : "Ingestion failed";
    throw new IngestionError(failureCode, message);
  }
}

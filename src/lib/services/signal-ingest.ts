import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { fetchRssItems, type RssEntryItem } from "@/lib/services/rss-fetch";

interface EnabledSource {
  id: string;
  rssUrl: string;
  name: string | null;
}

interface SignalRecord {
  id: string;
}

interface IngestionDeps {
  listEnabledSources: () => Promise<EnabledSource[]>;
  fetchRssItems: (rssUrl: string) => Promise<RssEntryItem[]>;
  findSignalBySourceAndUrl: (sourceId: string, url: string) => Promise<SignalRecord | null>;
  createSignal: (input: {
    sourceId: string;
    title: string;
    url: string;
    guid: string | null;
    summary: string | null;
    publishedAt: Date | null;
    rawEntryJson: Prisma.InputJsonValue;
  }) => Promise<SignalRecord>;
}

export interface SignalIngestionError {
  sourceId: string;
  sourceName: string | null;
  rssUrl: string;
  message: string;
}

export interface SignalIngestionSummary {
  sources: number;
  signals: number;
  duplicates: number;
  errors: SignalIngestionError[];
}

function defaultDeps(): IngestionDeps {
  return {
    listEnabledSources: () =>
      db.source.findMany({
        where: { enabled: true },
        select: {
          id: true,
          rssUrl: true,
          name: true
        }
      }),
    fetchRssItems,
    findSignalBySourceAndUrl: (sourceId, url) =>
      db.signal.findFirst({
        where: {
          sourceId,
          url
        },
        select: { id: true }
      }),
    createSignal: (input) =>
      db.signal.create({
        data: input,
        select: { id: true }
      })
  };
}

export async function ingestSignalsFromEnabledSources(
  deps: IngestionDeps = defaultDeps(),
  options: {
    concurrency?: number;
  } = {}
): Promise<SignalIngestionSummary> {
  const enabledSources = await deps.listEnabledSources();
  const summary: SignalIngestionSummary = {
    sources: enabledSources.length,
    signals: 0,
    duplicates: 0,
    errors: []
  };
  const normalizedConcurrency = Number.isFinite(options.concurrency)
    ? Math.max(1, Math.min(8, Math.floor(options.concurrency as number)))
    : 4;
  let cursor = 0;

  async function processSource(source: EnabledSource): Promise<void> {
    try {
      const items = await deps.fetchRssItems(source.rssUrl);
      const seenUrls = new Set<string>();

      for (const item of items) {
        if (seenUrls.has(item.url)) {
          summary.duplicates += 1;
          continue;
        }
        seenUrls.add(item.url);

        const existing = await deps.findSignalBySourceAndUrl(source.id, item.url);
        if (existing) {
          summary.duplicates += 1;
          continue;
        }

        await deps.createSignal({
          sourceId: source.id,
          title: item.title || "Untitled",
          url: item.url,
          guid: item.guid,
          summary: item.summary,
          publishedAt: item.publishedAt,
          rawEntryJson: item.rawEntryJson as Prisma.InputJsonValue
        });
        summary.signals += 1;
      }
    } catch (error) {
      summary.errors.push({
        sourceId: source.id,
        sourceName: source.name,
        rssUrl: source.rssUrl,
        message: error instanceof Error ? error.message : "rss ingestion failed"
      });
    }
  }

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= enabledSources.length) {
        return;
      }
      await processSource(enabledSources[index] as EnabledSource);
    }
  }

  const workerCount = Math.min(enabledSources.length, normalizedConcurrency);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return summary;
}

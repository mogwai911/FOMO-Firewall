import { db } from "@/lib/db";

export type SourcesServiceErrorCode = "INVALID_RSS_URL" | "DUPLICATE_SOURCE" | "SOURCE_NOT_FOUND";

export class SourcesServiceError extends Error {
  code: SourcesServiceErrorCode;

  constructor(code: SourcesServiceErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface SourceView {
  id: string;
  rssUrl: string;
  name: string | null;
  enabled: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface SourceRecord {
  id: string;
  rssUrl: string;
  name: string | null;
  tagsJson: unknown;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface SourcesServiceDeps {
  findByRssUrl: (rssUrl: string) => Promise<SourceRecord | null>;
  findById: (id: string) => Promise<SourceRecord | null>;
  createSource: (input: {
    rssUrl: string;
    name: string | null;
    tagsJson: string[];
    enabled: boolean;
  }) => Promise<SourceRecord>;
  updateSourceEnabled: (id: string, enabled: boolean) => Promise<SourceRecord>;
  deleteSource: (id: string) => Promise<{ id: string }>;
  listSources: () => Promise<SourceRecord[]>;
  ensureDefaultSources: () => Promise<void>;
}

export interface CreateSourceInput {
  rssUrl: string;
  name?: string;
  tags?: string[];
}

const DEFAULT_SOURCES: Array<{ rssUrl: string; name: string; tags: string[] }> = [
  {
    rssUrl: "https://www.jiqizhixin.com/rss",
    name: "机器之心",
    tags: []
  },
  {
    rssUrl: "https://www.qbitai.com/feed",
    name: "量子位",
    tags: []
  }
];

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/$/, "");
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeTags(input: string[] | undefined): string[] {
  if (!input) {
    return [];
  }

  return [...new Set(input.map((tag) => tag.trim()).filter(Boolean))];
}

function readTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function toSourceView(record: SourceRecord): SourceView {
  return {
    id: record.id,
    rssUrl: record.rssUrl,
    name: record.name,
    enabled: record.enabled,
    tags: readTags(record.tagsJson),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function defaultDeps(): SourcesServiceDeps {
  return {
    findByRssUrl: (rssUrl) =>
      db.source.findUnique({
        where: { rssUrl },
        select: {
          id: true,
          rssUrl: true,
          name: true,
          tagsJson: true,
          enabled: true,
          createdAt: true,
          updatedAt: true
        }
      }),
    findById: (id) =>
      db.source.findUnique({
        where: { id },
        select: {
          id: true,
          rssUrl: true,
          name: true,
          tagsJson: true,
          enabled: true,
          createdAt: true,
          updatedAt: true
        }
      }),
    createSource: (input) =>
      db.source.create({
        data: input,
        select: {
          id: true,
          rssUrl: true,
          name: true,
          tagsJson: true,
          enabled: true,
          createdAt: true,
          updatedAt: true
        }
      }),
    updateSourceEnabled: (id, enabled) =>
      db.source.update({
        where: { id },
        data: { enabled },
        select: {
          id: true,
          rssUrl: true,
          name: true,
          tagsJson: true,
          enabled: true,
          createdAt: true,
          updatedAt: true
        }
      }),
    deleteSource: (id) =>
      db.source.delete({
        where: { id },
        select: {
          id: true
        }
      }),
    listSources: () =>
      db.source.findMany({
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          rssUrl: true,
          name: true,
          tagsJson: true,
          enabled: true,
          createdAt: true,
          updatedAt: true
        }
      }),
    ensureDefaultSources: async () => {
      for (const source of DEFAULT_SOURCES) {
        await db.source.upsert({
          where: {
            rssUrl: source.rssUrl
          },
          create: {
            rssUrl: source.rssUrl,
            name: source.name,
            tagsJson: source.tags,
            enabled: true
          },
          update: {}
        });
      }
    }
  };
}

export async function createSource(input: CreateSourceInput, deps: SourcesServiceDeps = defaultDeps()): Promise<SourceView> {
  const rssUrl = normalizeUrl(input.rssUrl);
  if (!isValidHttpUrl(rssUrl)) {
    throw new SourcesServiceError("INVALID_RSS_URL", "rss url must be a valid http(s) url");
  }

  const existing = await deps.findByRssUrl(rssUrl);
  if (existing) {
    throw new SourcesServiceError("DUPLICATE_SOURCE", "rss source already exists");
  }

  const record = await deps.createSource({
    rssUrl,
    name: input.name?.trim() || null,
    tagsJson: normalizeTags(input.tags),
    enabled: true
  });

  return toSourceView(record);
}

export async function toggleSource(sourceId: string, enabled: boolean | undefined, deps: SourcesServiceDeps = defaultDeps()): Promise<SourceView> {
  const current = await deps.findById(sourceId);
  if (!current) {
    throw new SourcesServiceError("SOURCE_NOT_FOUND", "source not found");
  }

  const nextEnabled = typeof enabled === "boolean" ? enabled : !current.enabled;
  const updated = await deps.updateSourceEnabled(sourceId, nextEnabled);
  return toSourceView(updated);
}

export async function listSources(deps: SourcesServiceDeps = defaultDeps()): Promise<SourceView[]> {
  let rows = await deps.listSources();
  if (rows.length === 0) {
    await deps.ensureDefaultSources();
    rows = await deps.listSources();
  }
  return rows.map(toSourceView);
}

export async function deleteSource(sourceId: string, deps: SourcesServiceDeps = defaultDeps()): Promise<{ id: string }> {
  const current = await deps.findById(sourceId);
  if (!current) {
    throw new SourcesServiceError("SOURCE_NOT_FOUND", "source not found");
  }
  return deps.deleteSource(sourceId);
}

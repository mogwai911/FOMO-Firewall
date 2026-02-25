import { db } from "@/lib/db";

interface FyiSignalRow {
  updatedAt: Date;
  signal: {
    id: string;
    title: string;
    url: string;
    summary: string | null;
    publishedAt: Date | null;
    source: {
      id: string;
      name: string | null;
    };
  };
}

interface FyiDeps {
  listByDisposition: (limit: number) => Promise<FyiSignalRow[]>;
}

export class SignalFyiServiceError extends Error {
  code: "INVALID_LIMIT";

  constructor(code: "INVALID_LIMIT", message: string) {
    super(message);
    this.code = code;
  }
}

function defaultDeps(): FyiDeps {
  return {
    listByDisposition: (limit) =>
      db.signalDisposition.findMany({
        where: {
          label: "FYI"
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: limit,
        select: {
          updatedAt: true,
          signal: {
            select: {
              id: true,
              title: true,
              url: true,
              summary: true,
              publishedAt: true,
              source: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      })
  };
}

export async function listFyiSignals(
  input: { limit?: number },
  deps: FyiDeps = defaultDeps()
): Promise<
  Array<{
    id: string;
    title: string;
    url: string;
    summary: string | null;
    publishedAt: string | null;
    dispositionUpdatedAt: string;
    source: {
      id: string;
      name: string | null;
    };
  }>
> {
  const limit = input.limit ?? 20;
  if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
    throw new SignalFyiServiceError("INVALID_LIMIT", "limit must be within 1~100");
  }

  const rows = await deps.listByDisposition(Math.round(limit));
  return rows.map((row) => ({
    id: row.signal.id,
    title: row.signal.title,
    url: row.signal.url,
    summary: row.signal.summary,
    publishedAt: row.signal.publishedAt?.toISOString() ?? null,
    dispositionUpdatedAt: row.updatedAt.toISOString(),
    source: row.signal.source
  }));
}

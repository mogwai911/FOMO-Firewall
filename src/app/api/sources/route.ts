import { createSource, listSources, SourcesServiceError } from "@/lib/services/sources-service";

interface SourcesRouteDeps {
  createSource: typeof createSource;
  listSources: typeof listSources;
}

interface CreateSourceBody {
  rssUrl?: unknown;
  url?: unknown;
  name?: unknown;
  tags?: unknown;
}

function parseString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function createSourcesGetHandler(
  deps: SourcesRouteDeps = {
    createSource,
    listSources
  }
) {
  return async function GET(): Promise<Response> {
    const sources = await deps.listSources();
    return Response.json({ sources });
  };
}

export function createSourcesPostHandler(
  deps: SourcesRouteDeps = {
    createSource,
    listSources
  }
) {
  return async function POST(request: Request): Promise<Response> {
    let body: CreateSourceBody;
    try {
      body = (await request.json()) as CreateSourceBody;
    } catch {
      return Response.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    const rssUrl = parseString(body.rssUrl) ?? parseString(body.url);
    const name = parseString(body.name);
    const tags = parseTags(body.tags);

    if (!rssUrl) {
      return Response.json({ error: "RSS_URL_REQUIRED" }, { status: 400 });
    }
    if (!isValidHttpUrl(rssUrl)) {
      return Response.json({ error: "INVALID_RSS_URL" }, { status: 400 });
    }

    try {
      const source = await deps.createSource({
        rssUrl,
        name,
        tags
      });
      return Response.json({ source }, { status: 201 });
    } catch (error) {
      if (error instanceof SourcesServiceError) {
        const status = error.code === "DUPLICATE_SOURCE" ? 409 : 400;
        return Response.json({ error: error.code, message: error.message }, { status });
      }

      return Response.json({ error: "SOURCE_CREATE_FAILED" }, { status: 500 });
    }
  };
}

export const GET = createSourcesGetHandler();
export const POST = createSourcesPostHandler();

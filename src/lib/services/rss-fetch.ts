export interface RssEntryItem {
  title: string;
  url: string;
  guid: string | null;
  summary: string | null;
  publishedAt: Date | null;
  rawEntryJson: Record<string, unknown>;
}

export class RssFetchError extends Error {
  code: "INVALID_RSS_URL" | "FETCH_FAILED" | "PARSE_FAILED";

  constructor(code: "INVALID_RSS_URL" | "FETCH_FAILED" | "PARSE_FAILED", message: string) {
    super(message);
    this.code = code;
  }
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function extractTag(block: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const matched = block.match(regex);
  if (!matched?.[1]) {
    return null;
  }

  return normalizeExtractedText(matched[1]);
}

function extractAtomLink(block: string): string | null {
  const match = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  return match?.[1]?.trim() ?? null;
}

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function decodeHtmlEntities(input: string): string {
  const decodeNumeric = (value: string): string =>
    value
      .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
        String.fromCodePoint(Number.parseInt(code, 16))
      )
      .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)));

  let output = input;
  for (let index = 0; index < 2; index += 1) {
    output = decodeNumeric(output)
      .replace(/&nbsp;/gi, " ")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;|&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&");
  }
  return output;
}

function normalizeExtractedText(raw: string): string | null {
  const decoded = decodeHtmlEntities(raw);
  const unwrapped = decoded
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<!\[CDATA\[\s*\]\]>/gi, "");
  const text = unwrapped
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return null;
  }
  if (/^<!\[CDATA\[\s*\]\]>$/i.test(text)) {
    return null;
  }
  return text;
}

function normalizeSummary(summary: string | null): string | null {
  if (!summary) {
    return null;
  }
  if (summary.length <= 600) {
    return summary;
  }
  return `${summary.slice(0, 597)}...`;
}

function parseBlocks(xml: string, tag: "item" | "entry"): string[] {
  const regex = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi");
  return xml.match(regex) ?? [];
}

function parseBlock(block: string, atomMode: boolean): RssEntryItem | null {
  const title = extractTag(block, "title") ?? "Untitled";
  const guid = extractTag(block, "guid") ?? extractTag(block, "id");
  const summary = normalizeSummary(
    extractTag(block, "description") ??
      extractTag(block, "summary") ??
      extractTag(block, "content:encoded") ??
      extractTag(block, "content")
  );
  const publishedAt = parseDate(
    extractTag(block, "pubDate") ?? extractTag(block, "published") ?? extractTag(block, "updated")
  );
  const link = atomMode ? extractAtomLink(block) ?? extractTag(block, "link") : extractTag(block, "link");
  const url = (link ?? guid ?? "").trim();

  if (!url || !isValidHttpUrl(url)) {
    return null;
  }

  return {
    title,
    url,
    guid: guid?.trim() || null,
    summary: summary?.trim() || null,
    publishedAt,
    rawEntryJson: {
      title,
      url,
      guid: guid?.trim() || null,
      summary: summary?.trim() || null,
      publishedAt: publishedAt?.toISOString() ?? null
    }
  };
}

export function parseRssItems(xml: string): RssEntryItem[] {
  const trimmed = xml.trim();
  if (!trimmed) {
    return [];
  }

  const items = parseBlocks(trimmed, "item");
  const entries = parseBlocks(trimmed, "entry");
  const atomMode = items.length === 0 && entries.length > 0;
  const sourceBlocks = atomMode ? entries : items;

  return sourceBlocks.map((block) => parseBlock(block, atomMode)).filter((item): item is RssEntryItem => Boolean(item));
}

export async function fetchRssItems(
  rssUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<RssEntryItem[]> {
  const normalized = rssUrl.trim();
  if (!isValidHttpUrl(normalized)) {
    throw new RssFetchError("INVALID_RSS_URL", "rss url must be a valid http(s) url");
  }

  let response: Response;
  try {
    response = await fetchImpl(normalized, {
      headers: {
        "user-agent": "FOMO-Firewall/0.1 (+rss-fetch)"
      },
      cache: "no-store"
    });
  } catch (error) {
    throw new RssFetchError("FETCH_FAILED", error instanceof Error ? error.message : "request failed");
  }

  if (!response.ok) {
    throw new RssFetchError("FETCH_FAILED", `rss fetch failed with status ${response.status}`);
  }

  const text = await response.text();
  try {
    return parseRssItems(text);
  } catch (error) {
    throw new RssFetchError("PARSE_FAILED", error instanceof Error ? error.message : "rss parse failed");
  }
}

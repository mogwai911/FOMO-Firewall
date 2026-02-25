import { extractReadableContent } from "@/lib/services/readability";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; FOMO-Firewall/0.1; +https://local.dev/session-assistant)";
const MAX_EXCERPT_LENGTH = 1600;

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeExcerpt(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_EXCERPT_LENGTH) {
    return collapsed;
  }
  return `${collapsed.slice(0, MAX_EXCERPT_LENGTH - 3)}...`;
}

export async function fetchArticleExcerpt(
  articleUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const normalizedUrl = articleUrl.trim();
  if (!isHttpUrl(normalizedUrl)) {
    throw new Error("invalid article url");
  }

  const response = await fetchImpl(normalizedUrl, {
    headers: {
      "user-agent": DEFAULT_USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`article fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const readable = extractReadableContent(html);
  const excerpt = normalizeExcerpt(readable.extractedText);
  if (!excerpt) {
    throw new Error("article excerpt is empty");
  }
  return excerpt;
}

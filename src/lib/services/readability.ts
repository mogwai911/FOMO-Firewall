export interface ReadabilityExtractResult {
  title?: string;
  author?: string;
  publishedAt?: Date;
  extractedText: string;
}

function stripTags(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function pickMetaContent(html: string, marker: RegExp): string | undefined {
  const match = html.match(marker);
  return match?.[1]?.trim();
}

export function extractReadableContent(html: string): ReadabilityExtractResult {
  const title = pickMetaContent(html, /<title[^>]*>([^<]+)<\/title>/i);
  const author =
    pickMetaContent(html, /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i) ??
    pickMetaContent(html, /<meta[^>]+property=["']author["'][^>]+content=["']([^"']+)["']/i);
  const publishedRaw =
    pickMetaContent(
      html,
      /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i
    ) ??
    pickMetaContent(
      html,
      /<meta[^>]+name=["']publish-date["'][^>]+content=["']([^"']+)["']/i
    );

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const textSource = bodyMatch?.[1] ?? html;
  const extractedText = stripTags(textSource);
  if (!extractedText) {
    throw new Error("empty extraction content");
  }

  const publishedAt = publishedRaw ? new Date(publishedRaw) : undefined;
  return {
    title,
    author,
    publishedAt:
      publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
    extractedText
  };
}

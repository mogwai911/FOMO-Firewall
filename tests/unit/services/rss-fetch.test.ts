import { describe, expect, it } from "vitest";
import { parseRssItems } from "@/lib/services/rss-fetch";

describe("rss-fetch parser", () => {
  it("uses content:encoded when description is cdata placeholder", () => {
    const xml = `
      <rss version="2.0">
        <channel>
          <item>
            <title>示例文章</title>
            <link>https://example.com/article-1</link>
            <description>&lt;![CDATA[]]&gt;</description>
            <content:encoded>&lt;![CDATA[&lt;p&gt;这是正文摘要&lt;/p&gt;]]&gt;</content:encoded>
            <pubDate>Sat, 21 Feb 2026 00:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
    `;

    const items = parseRssItems(xml);
    expect(items).toHaveLength(1);
    expect(items[0]?.summary).toBe("这是正文摘要");
  });

  it("maps placeholder-only description to null summary", () => {
    const xml = `
      <rss version="2.0">
        <channel>
          <item>
            <title>占位摘要文章</title>
            <link>https://example.com/article-2</link>
            <description>&lt;![CDATA[]]&gt;</description>
          </item>
        </channel>
      </rss>
    `;

    const items = parseRssItems(xml);
    expect(items).toHaveLength(1);
    expect(items[0]?.summary).toBeNull();
  });
});

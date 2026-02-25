import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("session markdown rendering", () => {
  it("renders chat messages via markdown renderer", () => {
    const pagePath = resolve(process.cwd(), "src/app/app/session/[sessionId]/page.tsx");
    const source = readFileSync(pagePath, "utf-8");

    expect(source).toContain("MarkdownContent");
  });
});

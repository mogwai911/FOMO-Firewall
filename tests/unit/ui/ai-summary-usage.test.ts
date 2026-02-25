import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ai summary usage", () => {
  it("uses ai summary helper in digest and session-home views", () => {
    const digestSource = readFileSync(resolve(process.cwd(), "src/app/app/digest/page.tsx"), "utf-8");
    const sessionHomeSource = readFileSync(resolve(process.cwd(), "src/app/app/session/page.tsx"), "utf-8");

    expect(digestSource).toContain("pickAiSummaryText(");
    expect(sessionHomeSource).toContain("pickAiSummaryText(");
  });
});

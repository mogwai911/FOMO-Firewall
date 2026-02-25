import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("digest url sync", () => {
  it("does not call router side-effects inside setViewState updater", () => {
    const pagePath = resolve(process.cwd(), "src/app/app/digest/page.tsx");
    const source = readFileSync(pagePath, "utf-8");

    expect(source).not.toContain("replaceUrlState(next);");
  });
});

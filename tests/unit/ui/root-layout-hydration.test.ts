import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("root layout hydration guard", () => {
  it("marks body with suppressHydrationWarning to tolerate extension-injected attrs", () => {
    const layoutPath = resolve(process.cwd(), "src/app/layout.tsx");
    const source = readFileSync(layoutPath, "utf-8");

    expect(source).toMatch(/<body[^>]*suppressHydrationWarning/);
  });
});

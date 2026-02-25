import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("digest range controls", () => {
  it("uses mutually exclusive pressed state for range buttons", () => {
    const pagePath = resolve(process.cwd(), "src/app/app/digest/page.tsx");
    const source = readFileSync(pagePath, "utf-8");

    expect(source).toContain("aria-pressed={viewState.windowDays === option.value}");
  });

  it("uses user-friendly manual refresh copy", () => {
    const pagePath = resolve(process.cwd(), "src/app/app/digest/page.tsx");
    const source = readFileSync(pagePath, "utf-8");

    expect(source).toContain('{refreshing ? "更新中..." : "更新日报"}');
    expect(source).not.toContain("更新这段时间日报");
  });

  it("shows refresh progress hint and persists marker key across navigation", () => {
    const pagePath = resolve(process.cwd(), "src/app/app/digest/page.tsx");
    const source = readFileSync(pagePath, "utf-8");

    expect(source).toContain('data-testid="digest-refresh-progress"');
    expect(source).toContain("任务会在后台继续");
    expect(source).toContain("fomo.digest.refresh-marker");
  });
});

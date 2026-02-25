import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf-8");
}

describe("eva-inspired bright skin", () => {
  it("defines light-surface tokens while keeping cyan-red accents", () => {
    const globals = read("src/app/globals.css");

    expect(globals).toContain("--eva-paper");
    expect(globals).toContain("--eva-ink");
    expect(globals).toContain("--eva-cyan");
    expect(globals).toContain("--eva-red");
  });

  it("keeps body background bright and airy", () => {
    const globals = read("src/app/globals.css");

    expect(globals).toContain("linear-gradient(165deg, #f8fbff");
    expect(globals).toContain("rgba(255, 255, 255, 0.92)");
  });

  it("uses light material panels in shell and app pages", () => {
    const shell = read("src/components/app-shell.module.css");
    const demo = read("src/app/demo-ui.module.css");

    expect(shell).toContain("rgba(255, 255, 255");
    expect(demo).toContain("var(--eva-surface)");
    expect(demo).toContain("rgba(255, 255, 255, 0.82)");
  });
});

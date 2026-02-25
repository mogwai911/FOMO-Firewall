import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf-8");
}

describe("liquid glass quick pass", () => {
  it("defines reusable glass tokens", () => {
    const globals = read("src/app/globals.css");

    expect(globals).toContain("--glass-blur");
    expect(globals).toContain("--glass-panel");
    expect(globals).toContain("--glass-stroke");
  });

  it("applies glass blur and highlight to shell surfaces", () => {
    const shell = read("src/components/app-shell.module.css");

    expect(shell).toContain("backdrop-filter");
    expect(shell).toContain("-webkit-backdrop-filter");
    expect(shell).toContain("inset 0 1px 0 rgba(255, 255, 255");
  });

  it("applies liquid-glass treatment to controls and content cards", () => {
    const ui = read("src/app/demo-ui.module.css");

    expect(ui).toContain("var(--glass-panel)");
    expect(ui).toContain("var(--glass-stroke)");
    expect(ui).toContain("var(--glass-blur)");
  });

  it("separates controls from background with dedicated glass highlight tokens", () => {
    const globals = read("src/app/globals.css");
    const shell = read("src/components/app-shell.module.css");
    const ui = read("src/app/demo-ui.module.css");

    expect(globals).toContain("--glass-control-shadow");
    expect(globals).toContain("--glass-control-stroke");
    expect(shell).toContain("var(--glass-control-shadow)");
    expect(ui).toContain("var(--glass-control-shadow)");
    expect(ui).toContain("var(--glass-control-stroke)");
  });
});

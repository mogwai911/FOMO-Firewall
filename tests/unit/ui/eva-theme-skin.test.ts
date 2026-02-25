import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf-8");
}

describe("eva-inspired skin theme", () => {
  it("defines high-contrast cyan-red palette tokens in global styles", () => {
    const globals = read("src/app/globals.css");

    expect(globals).toContain("--eva-cyan");
    expect(globals).toContain("--eva-red");
    expect(globals).toContain("--eva-orange");
    expect(globals).toContain("--eva-surface");
  });

  it("uses display/body font pair aligned to neo-industrial look", () => {
    const layout = read("src/app/layout.tsx");

    expect(layout).toContain("Noto_Sans_SC");
    expect(layout).toContain("Exo_2");
  });

  it("skins shell and app surfaces with cyan-red material styling", () => {
    const shell = read("src/components/app-shell.module.css");
    const ui = read("src/app/demo-ui.module.css");

    expect(shell).toContain("rgba(0, 204, 232");
    expect(shell).toContain("rgba(255, 90, 77");
    expect(ui).toContain("var(--eva-surface)");
    expect(ui).toContain("linear-gradient(135deg, var(--eva-red), var(--eva-orange))");
  });
});

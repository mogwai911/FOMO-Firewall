import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf-8");
}

describe("form error visibility", () => {
  it("styles formError as a high-visibility alert bar with micro animation", () => {
    const css = read("src/app/demo-ui.module.css");

    expect(css).toContain(".formError::before");
    expect(css).toContain("border-left: 4px solid");
    expect(css).toContain("0 8px 18px rgba(214, 58, 47, 0.16)");
    expect(css).toContain("animation: formErrorPulse 1.8s ease-in-out 2");
    expect(css).toContain("@keyframes formErrorPulse");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("digest confirm modal", () => {
  it("uses in-app confirm modal component instead of browser confirm dialogs", () => {
    const pagePath = resolve(process.cwd(), "src/app/app/digest/page.tsx");
    const source = readFileSync(pagePath, "utf-8");

    expect(source).not.toContain("window.confirm(");
    expect(source).toContain("ConfirmModal");
    expect(source).not.toContain("styles.confirmOverlay");
  });
});

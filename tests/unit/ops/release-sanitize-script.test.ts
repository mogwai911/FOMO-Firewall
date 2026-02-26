import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("release sanitize script", () => {
  it("does not use createMany skipDuplicates (sqlite unsupported)", () => {
    const scriptPath = path.resolve(process.cwd(), "scripts/release/sanitize-db.mjs");
    const content = readFileSync(scriptPath, "utf8");

    expect(content).not.toContain("skipDuplicates");
  });
});

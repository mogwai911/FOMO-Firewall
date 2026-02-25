import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("evidence trace fallback", () => {
  it("renders unavailable state when source session has been deleted", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/app/evidence/[evidenceId]/page.tsx"),
      "utf-8"
    );

    expect(source).toContain("sessionAvailable");
    expect(source).toContain("会话已删除，无法继续回到会话。");
  });
});

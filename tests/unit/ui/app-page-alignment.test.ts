import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf-8");
}

describe("app page alignment", () => {
  it("removes page-level quick jump blocks from session/cards/evidence/settings/fyi", () => {
    const sessionHome = readSource("src/app/app/session/page.tsx");
    const sessionDetail = readSource("src/app/app/session/[sessionId]/page.tsx");
    const cards = readSource("src/app/app/cards/page.tsx");
    const evidence = readSource("src/app/app/evidence/[evidenceId]/page.tsx");
    const settings = readSource("src/app/app/settings/page.tsx");
    const fyi = readSource("src/app/app/fyi/page.tsx");

    expect(sessionHome).not.toContain("session-home-quick-actions");
    expect(sessionDetail).not.toContain("session-detail-quick-actions");
    expect(cards).not.toContain("cards-quick-actions");
    expect(cards).not.toContain("cards-tab-review");
    expect(cards).not.toContain("cards-tab-library");
    expect(evidence).not.toContain("evidence-quick-actions");
    expect(settings).not.toContain("settings-quick-actions");
    expect(fyi).not.toContain("fyi-quick-actions");
  });

  it("uses nav-aligned title for session pages", () => {
    const sessionHome = readSource("src/app/app/session/page.tsx");
    const sessionDetail = readSource("src/app/app/session/[sessionId]/page.tsx");

    expect(sessionHome).toContain('title="学习会话"');
    expect(sessionDetail).toContain('title="学习会话"');
    expect(sessionHome).not.toContain("学习会话中心");
    expect(sessionDetail).not.toContain("学习会话详情");
  });
});

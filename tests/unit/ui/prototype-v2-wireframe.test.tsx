import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrototypePage from "@/app/prototype/page";
import { REQUIRED_FRAME_IDS } from "@/lib/prototype/frame-registry";

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

describe("prototype showroom v2", () => {
  it("keeps requested frame groups", () => {
    const html = renderToStaticMarkup(<PrototypePage />);

    expect(html).toContain("AppShell");
    expect(html).toContain("Digest");
    expect(html).toContain("Sources");
    expect(html).toContain("Session");
    expect(html).toContain("Cards");
    expect(html).toContain("Evidence");
  });

  it("renders every frame as full-screen wireframe with app shell and callout", () => {
    const html = renderToStaticMarkup(<PrototypePage />);

    const expectedScreens = REQUIRED_FRAME_IDS.length + 1;
    for (const frameId of REQUIRED_FRAME_IDS) {
      expect(html).toContain(frameId);
    }
    expect(html).toContain("AppShell-FrameA1");

    expect(countMatches(html, /data-wireframe-screen=\"true\"/g)).toBe(expectedScreens);
    expect(countMatches(html, /data-app-shell=\"true\"/g)).toBe(expectedScreens);
    expect(countMatches(html, /data-callout=\"true\"/g)).toBeGreaterThanOrEqual(expectedScreens);
  });

  it("keeps Digest drawer field order and Session job states", () => {
    const html = renderToStaticMarkup(<PrototypePage />);

    const headlineIdx = html.indexOf("headline");
    const reasonsIdx = html.indexOf("reasons (&lt;=3)");
    const snippetsIdx = html.indexOf("snippets (&lt;=2)");
    const nextHintIdx = html.indexOf("next_action_hint");

    expect(headlineIdx).toBeGreaterThan(-1);
    expect(reasonsIdx).toBeGreaterThan(headlineIdx);
    expect(snippetsIdx).toBeGreaterThan(reasonsIdx);
    expect(nextHintIdx).toBeGreaterThan(snippetsIdx);

    expect(html).toContain("queued/running");
    expect(html).toContain("done");
    expect(html).toContain("点击 DO 后出现 CTA");
    expect(html).toContain("退出=paused，自动保存");
  });
});

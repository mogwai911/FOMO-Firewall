import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/app-shell";

describe("AppShell frame alignment", () => {
  it("renders wireframe-style top meta pills for prototype-aligned shell", () => {
    const html = renderToStaticMarkup(
      <AppShell active="digest" title="日报处置" subtitle="用于测试">
        <div>content</div>
      </AppShell>
    );

    expect(html).toContain('data-testid="shell-top-meta"');
    expect(html).toContain("Wireframe UI");
    expect(html).toContain("主链路在线");
  });
});

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/app-shell";

describe("AppShell nav", () => {
  it("renders stable nav entries with expected app routes", () => {
    const html = renderToStaticMarkup(
      <AppShell active="digest" title="日报处置">
        <div>content</div>
      </AppShell>
    );

    expect(html).toContain('data-testid="nav-digest"');
    expect(html).toContain('href="/app/digest"');
    expect(html).toContain('data-testid="nav-session"');
    expect(html).toContain('href="/app/session"');
    expect(html).toContain('data-testid="nav-memory"');
    expect(html).toContain('href="/app/cards"');
    expect(html).toContain('data-testid="nav-settings"');
    expect(html).toContain('href="/app/settings"');
    expect(html).not.toContain('data-testid="nav-sources"');

    expect(html).not.toContain('data-testid="quick-nav-digest"');
    expect(html).not.toContain('data-testid="quick-nav-session"');
    expect(html).not.toContain('data-testid="quick-nav-memory"');
    expect(html).not.toContain('data-testid="quick-nav-settings"');
  });
});

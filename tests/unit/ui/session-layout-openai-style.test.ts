import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("session layout openai style", () => {
  it("uses a scrollable sidebar and chat viewport layout", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/app/session/[sessionId]/page.tsx"),
      "utf-8"
    );

    expect(source).toContain("sessionWorkspace");
    expect(source).toContain("sessionSidebarScroll");
    expect(source).toContain("sessionMessagesViewport");
  });

  it("does not expose active/paused status copy to users", () => {
    const homeSource = readFileSync(resolve(process.cwd(), "src/app/app/session/page.tsx"), "utf-8");
    const detailSource = readFileSync(
      resolve(process.cwd(), "src/app/app/session/[sessionId]/page.tsx"),
      "utf-8"
    );

    expect(homeSource).not.toContain("进行中");
    expect(homeSource).not.toContain("已暂停");
    expect(detailSource).not.toContain("会话状态：");
  });

  it("shows useful session sidebar info and cleaner action labels", () => {
    const detailSource = readFileSync(
      resolve(process.cwd(), "src/app/app/session/[sessionId]/page.tsx"),
      "utf-8"
    );

    expect(detailSource).toContain("AI 总结");
    expect(detailSource).toContain("打开原文");
    expect(detailSource).toContain("返回会话列表");
    expect(detailSource).toContain("生成洞察卡");
    expect(detailSource).toContain("查看洞察卡");
    expect(detailSource).not.toContain("返回日报");
    expect(detailSource).not.toContain("自动保存已开启");
    expect(detailSource).not.toContain("生成闪卡");
    expect(detailSource).not.toContain("生成闪卡（后台）");
    expect(detailSource).not.toContain("生成证据包（后台）");
  });

  it("constrains session workspace height so chat scroll stays inside the app shell", () => {
    const cssSource = readFileSync(resolve(process.cwd(), "src/app/demo-ui.module.css"), "utf-8");
    expect(cssSource).toContain("height: calc(100dvh - 190px)");
    expect(cssSource).toContain("grid-template-rows: auto minmax(0, 1fr) auto");
    expect(cssSource).toContain(".sessionSidebar");
    expect(cssSource).toContain("height: 100%");
    expect(cssSource).toContain("overflow: hidden");
    expect(cssSource).toContain("align-content: start");
  });

  it("uses semantic summary block and neutral-first status badges in tool rows", () => {
    const detailSource = readFileSync(
      resolve(process.cwd(), "src/app/app/session/[sessionId]/page.tsx"),
      "utf-8"
    );
    const cssSource = readFileSync(resolve(process.cwd(), "src/app/demo-ui.module.css"), "utf-8");

    expect(detailSource).toContain("summaryTitle");
    expect(detailSource).toContain("summaryContent");
    expect(detailSource).toContain("jobStatusToneClass");

    expect(cssSource).toContain(".summaryTitle");
    expect(cssSource).toContain(".summaryContent");
    expect(cssSource).toContain(".statusIdle");
    expect(cssSource).toContain(".statusDone");
    expect(cssSource).toContain(".statusFailed");
    const summaryBlockMatch = cssSource.match(/\.summaryContent\s*\{[\s\S]*?\}/);
    expect(summaryBlockMatch).not.toBeNull();
    const summaryBlock = summaryBlockMatch![0];
    expect(summaryBlock).toContain("max-height: 210px");
    expect(summaryBlock).toContain("overflow-y: scroll");
    expect(summaryBlock).toContain("scrollbar-gutter: stable");
  });

  it("keeps sidebar structure functional and avoids extra decorative wrappers", () => {
    const detailSource = readFileSync(
      resolve(process.cwd(), "src/app/app/session/[sessionId]/page.tsx"),
      "utf-8"
    );
    const cssSource = readFileSync(resolve(process.cwd(), "src/app/demo-ui.module.css"), "utf-8");

    expect(detailSource).toContain("sidebarSection");
    expect(detailSource).toContain("toolRow");
    expect(detailSource).toContain("sidebarSectionHeader");

    expect(detailSource).not.toContain("jobPanel");
    expect(detailSource).not.toContain("jobRow");

    expect(cssSource).toContain(".sidebarSection");
    expect(cssSource).toContain(".toolRow");
    expect(cssSource).toContain(".sidebarSectionHeader");
    expect(cssSource).not.toContain(".jobPanel {");
    expect(cssSource).not.toContain(".jobRow {");
  });
});

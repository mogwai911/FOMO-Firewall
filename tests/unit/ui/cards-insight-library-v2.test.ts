import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("cards insight library v2", () => {
  it("removes action-oriented wording and keeps summary-oriented sections", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "src/app/app/cards/page.tsx"),
      "utf-8"
    );

    expect(pageSource).not.toContain("建议动作");
    expect(pageSource).not.toContain("下一步");
    expect(pageSource).toContain("摘要");
    expect(pageSource).toContain("核心论点");
    expect(pageSource).toContain("关键证据");
    expect(pageSource).toContain("局限边界");
  });

  it("uses adaptive abstract preview strategy and stable list actions", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "src/app/app/cards/page.tsx"),
      "utf-8"
    );
    const cssSource = readFileSync(resolve(process.cwd(), "src/app/demo-ui.module.css"), "utf-8");

    expect(pageSource).toContain("insightListCard");
    expect(pageSource).toContain("insightAbstractPreview");
    expect(pageSource).toContain("insightAbstractExpanded");
    expect(pageSource).toContain("insightListAction");
    expect(pageSource).toContain("filteredCards.length <= 3");

    expect(cssSource).toContain(".insightListCard");
    expect(cssSource).toContain(".insightAbstractPreview");
    expect(cssSource).toContain(".insightAbstractExpanded");
    expect(cssSource).toContain("-webkit-line-clamp: unset");
    expect(cssSource).toContain(".insightListAction");
    expect(cssSource).toContain("justify-self: start");
    expect(cssSource).toContain(".insightGrid");
    expect(cssSource).toContain("align-items: start");
  });

  it("adds cards-page-specific typography classes for readable hierarchy", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "src/app/app/cards/page.tsx"),
      "utf-8"
    );
    const cssSource = readFileSync(resolve(process.cwd(), "src/app/demo-ui.module.css"), "utf-8");

    expect(pageSource).toContain("insightListPanel");
    expect(pageSource).toContain("insightDetailPanel");
    expect(pageSource).toContain("insightListTitle");
    expect(pageSource).toContain("insightSectionHeading");
    expect(pageSource).toContain("insightDetailList");

    expect(cssSource).toContain(".insightListPanel");
    expect(cssSource).toContain(".insightDetailPanel");
    expect(cssSource).toContain(".insightListTitle");
    expect(cssSource).toContain(".insightSectionHeading");
    expect(cssSource).toContain(".insightDetailList");
  });

  it("supports deleting selected insight card with in-app confirmation modal", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "src/app/app/cards/page.tsx"),
      "utf-8"
    );

    expect(pageSource).toContain("deleteInsightCard");
    expect(pageSource).toContain("data-testid=\"insight-detail-delete\"");
    expect(pageSource).toContain("删除洞察卡？");
    expect(pageSource).toContain("ConfirmModal");
  });
});

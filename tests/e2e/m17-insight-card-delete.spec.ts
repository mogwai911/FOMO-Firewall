import { expect, test } from "@playwright/test";
import { resetAppData, seedSignalForToday } from "./fixtures/db-seed";

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

test.beforeEach(async () => {
  await resetAppData();
  await seedSignalForToday({
    signalTitle: "M17 Insight Delete Signal"
  });
});

test("M17 path: user can delete insight card from memory library", async ({ page }) => {
  await page.goto("/app/digest");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(`/api/digest/${todayDateKey()}/manual-refresh`) &&
        response.ok()
    ),
    page.getByTestId("digest-manual-refresh").click()
  ]);

  const signalCard = page.getByTestId(/signal-.+/).first();
  await signalCard.getByTestId(/do-.+/).click();
  await expect(page.getByTestId("confirm-modal")).toBeVisible();
  await page.getByTestId("confirm-modal-confirm").click();
  await expect(page).toHaveURL(/\/app\/session\//);

  await page.getByTestId("session-input").fill("提炼一份核心洞察");
  await page.getByTestId("session-send").click();
  await page.getByTestId("job-insight-card").click();
  await expect(page.getByTestId("insight-card-status")).toHaveText("已完成", { timeout: 9000 });

  await page.getByTestId("view-insight-card").click();
  await expect(page).toHaveURL(/\/app\/cards/);
  await expect(page.getByTestId("insight-card-count")).toContainText("共 1 条洞察卡");

  await page.getByTestId("insight-detail-delete").click();
  await expect(page.getByTestId("confirm-modal-title")).toContainText("删除洞察卡");
  await page.getByTestId("confirm-modal-confirm").click();

  await expect(page.getByText("还没有洞察卡。请在学习会话里点击“生成洞察卡”。")).toBeVisible();
});

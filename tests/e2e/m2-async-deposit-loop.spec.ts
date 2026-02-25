import { expect, test } from "@playwright/test";
import { resetAppData, seedSignalForToday } from "./fixtures/db-seed";

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

test.beforeEach(async () => {
  await resetAppData();
  await seedSignalForToday({
    signalTitle: "M2 Signal"
  });
});

test("M2 path: session async jobs -> cards/evidence -> trace back session (real API)", async ({ page }) => {
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
  await page.getByTestId("session-input").fill("给我一份可执行计划");
  await page.getByTestId("session-send").click();

  await page.getByTestId("job-insight-card").click();
  await expect(page.getByTestId("insight-card-status")).toHaveText("已完成", { timeout: 9000 });
  await page.getByTestId("view-insight-card").click();
  await expect(page).toHaveURL(/\/app\/cards/);
  await expect(page.getByRole("heading", { name: "记忆库" })).toBeVisible();
  await expect(page.getByText("建议动作")).toHaveCount(0);
  await expect(page.getByText("下一步")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "摘要" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "核心论点" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "关键证据" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "局限边界" })).toBeVisible();
  await page.getByTestId("insight-detail-back-session").click();
  await expect(page).toHaveURL(/\/app\/session\//);

  await page.getByRole("button", { name: "生成证据包" }).click();
  await expect(page.getByRole("button", { name: "查看证据包" })).toBeVisible({ timeout: 9000 });
  await page.getByRole("button", { name: "查看证据包" }).click();
  await expect(page).toHaveURL(/\/app\/evidence\//);
  await expect(page.getByRole("heading", { name: "记忆库" })).toBeVisible();
  await expect(page.getByTestId("evidence-quick-actions")).toHaveCount(0);
  await expect(page.getByTestId("evidence-main-sections")).toBeVisible();

  await page.getByRole("button", { name: "继续聊（回到会话）" }).click();
  await expect(page).toHaveURL(/\/app\/session\//);
});

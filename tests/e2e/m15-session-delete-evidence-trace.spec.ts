import { expect, test } from "@playwright/test";
import { resetAppData, seedSignalForToday } from "./fixtures/db-seed";

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

test.beforeEach(async () => {
  await resetAppData();
  await seedSignalForToday({
    signalTitle: "Session Delete Evidence Signal"
  });
});

test("M15 path: deleting session keeps evidence but disables session trace actions", async ({
  page,
  request
}) => {
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

  await page.getByTestId(/do-.+/).first().click();
  await expect(page.getByTestId("confirm-modal")).toBeVisible();
  await page.getByTestId("confirm-modal-confirm").click();
  await expect(page).toHaveURL(/\/app\/session\/(.+)/);
  const sessionId = page.url().split("/app/session/")[1];

  await page.getByTestId("session-input").fill("先总结一下核心信息");
  await page.getByTestId("session-send").click();
  await expect(page.getByTestId("session-messages-viewport")).toContainText("先总结一下核心信息");

  await page.getByRole("button", { name: "生成证据包" }).click();
  await expect(page.getByRole("button", { name: "查看证据包" })).toBeVisible({ timeout: 9000 });
  await page.getByRole("button", { name: "查看证据包" }).click();
  await expect(page).toHaveURL(/\/app\/evidence\/(.+)/);
  const evidenceUrl = page.url();

  const deleteResponse = await request.delete(`/api/sessions/${sessionId}`);
  expect(deleteResponse.ok()).toBe(true);

  await page.goto(evidenceUrl);
  await expect(page.getByText("会话已删除，无法继续回到会话。")).toBeVisible();
  await expect(page.getByRole("button", { name: "继续聊（回到会话）" })).toHaveCount(0);
});

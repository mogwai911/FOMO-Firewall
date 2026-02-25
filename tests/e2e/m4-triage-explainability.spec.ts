import { expect, test } from "@playwright/test";
import { resetAppData, seedSignalForToday } from "./fixtures/db-seed";

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

test.beforeEach(async () => {
  await resetAppData();
  await seedSignalForToday({
    sourceName: "Triage Source",
    signalTitle: "OpenAI release update",
    summary: "本次发布包含接口变更与迁移提示。"
  });
});

test("M4 path: digest triage card shows headline/reasons/snippets", async ({ page }) => {
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

  await expect(page.getByTestId(/signal-.+/).first()).toBeVisible();
  await page.getByTestId(/signal-reason-.+/).first().click();

  await expect(page.getByTestId("digest-drawer")).toBeVisible();
  await expect(page.getByTestId("digest-drawer-overlay")).toBeVisible();
  const generateButton = page.getByRole("button", { name: "生成处置卡" });
  if (await generateButton.isVisible()) {
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          /\/api\/signals\/.+\/triage$/.test(response.url()) &&
          response.ok()
      ),
      generateButton.click()
    ]);
  }
  await expect(page.getByText("价值判断")).toBeVisible();
  await expect(page.getByText("引用片段")).toBeVisible();
  await expect(page.getByText("建议动作")).toBeVisible();
});

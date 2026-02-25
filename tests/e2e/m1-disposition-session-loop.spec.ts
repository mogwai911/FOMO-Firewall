import { expect, test } from "@playwright/test";
import { resetAppData, seedSignalForToday } from "./fixtures/db-seed";

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

test.beforeEach(async () => {
  await resetAppData();
  await seedSignalForToday({
    signalTitle: "M1 Signal"
  });
});

test("M1 path: disposition -> session -> autosave -> resume (real API)", async ({ page }) => {
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
  await expect(page.getByRole("heading", { name: "学习会话" })).toBeVisible();
  await expect(page.getByTestId("session-detail-quick-actions")).toHaveCount(0);
  await expect(page.getByTestId("session-suggested-questions")).toBeVisible();
  await expect(page.getByRole("heading", { name: "你可能想问" })).toBeVisible();
  await expect(page.getByTestId("session-suggested-question")).toHaveCount(3);
  await expect(page.getByTestId("session-suggested-questions")).not.toContainText(
    "如果今天只做一件事，我应该先验证哪个指标？"
  );
  await page.getByTestId("session-input").fill("先帮我梳理关键结论");
  await page.getByTestId("session-send").click();
  await expect(page.getByTestId("session-suggested-questions")).toHaveCount(0);
  await expect(page.getByTestId("session-messages-viewport")).toContainText("先帮我梳理关键结论");
  await expect(page.getByText(/LLM_CONFIG_MISSING/)).toBeVisible();

  await page.getByTestId("nav-digest").click();
  await expect(page).toHaveURL(/\/app\/digest(\?|$)/);

  await page.getByTestId("digest-tab-do").click();
  await expect(page.getByTestId(/session-cta-.+/)).toContainText("继续学习");
  await page.getByTestId(/session-cta-.+/).click();
  await expect(page.getByTestId("session-messages-viewport")).toContainText("先帮我梳理关键结论");
});

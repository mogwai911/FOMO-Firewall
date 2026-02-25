import { expect, test } from "@playwright/test";
import { resetAppData, seedSignalForToday } from "./fixtures/db-seed";

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

test.beforeEach(async () => {
  await resetAppData();
  await seedSignalForToday({
    signalTitle: "FYI Signal Example"
  });
});

test("M7 path: mark FYI in digest and view in FYI list", async ({ page }) => {
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
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/signals/") &&
        response.url().includes("/disposition") &&
        response.ok()
    ),
    signalCard.getByRole("button", { name: "稍后看" }).click()
  ]);

  await page.goto("/app/fyi");
  await expect(page.getByTestId("fyi-list")).toBeVisible();
  await expect(page.getByRole("heading", { name: "稍后看池" })).toBeVisible();
  await expect(page.getByTestId("fyi-quick-actions")).toHaveCount(0);
  await expect(page.getByText("FYI Signal Example")).toBeVisible();

  await page.getByTestId("nav-digest").click();
  await expect(page).toHaveURL("/app/digest");
  await page.getByTestId("nav-digest").click();
  await expect(page).toHaveURL("/app/digest");
});

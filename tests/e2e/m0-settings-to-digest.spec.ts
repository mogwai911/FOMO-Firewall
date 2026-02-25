import { expect, test } from "@playwright/test";
import { resetAppData, seedSignalForToday } from "./fixtures/db-seed";

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

test.beforeEach(async () => {
  await resetAppData();
  await seedSignalForToday({
    sourceName: "M0 Source",
    signalTitle: "M0 Signal"
  });
});

test("M0 path: top navigation routes are stable", async ({ page }) => {
  await page.goto("/app/digest");

  await expect(page.getByTestId("nav-digest")).toBeVisible();
  await expect(page.getByTestId("nav-session")).toBeVisible();
  await expect(page.getByTestId("nav-memory")).toBeVisible();
  await expect(page.getByTestId("nav-settings")).toBeVisible();
  await expect(page.getByTestId("quick-nav-digest")).toHaveCount(0);
  await expect(page.getByTestId("quick-nav-session")).toHaveCount(0);
  await expect(page.getByTestId("quick-nav-memory")).toHaveCount(0);
  await expect(page.getByTestId("quick-nav-settings")).toHaveCount(0);
  await expect(page.getByTestId("digest-go-settings")).toHaveCount(0);
  await expect(page.getByTestId("digest-go-session")).toHaveCount(0);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(`/api/digest/${todayDateKey()}/manual-refresh`) &&
        response.ok()
    ),
    page.getByTestId("digest-manual-refresh").click()
  ]);

  await expect(page.getByText("M0 Source").first()).toBeVisible();
  await expect(page.getByText("M0 Signal").first()).toBeVisible();

  await page.getByTestId("nav-settings").click();
  await expect(page).toHaveURL("/app/settings");
  await page.getByTestId("nav-digest").click();
  await expect(page).toHaveURL("/app/digest");
  await page.getByTestId("nav-session").click();
  await expect(page).toHaveURL("/app/session");
  await page.getByTestId("nav-memory").click();
  await expect(page).toHaveURL("/app/cards");
  await page.getByTestId("nav-settings").click();
  await expect(page).toHaveURL("/app/settings");
});

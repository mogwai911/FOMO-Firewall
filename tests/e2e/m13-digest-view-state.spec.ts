import { expect, test } from "@playwright/test";
import { resetAppData, seedSignalForToday } from "./fixtures/db-seed";

test.beforeEach(async () => {
  await resetAppData();
  await seedSignalForToday({
    sourceName: "Digest State Source",
    signalTitle: "Digest State Signal A",
    withTriage: false
  });
  await seedSignalForToday({
    sourceName: "Digest State Source",
    signalTitle: "Digest State Signal B",
    withTriage: false
  });
});

test("M13 path: digest view state is kept by URL when navigating away and back", async ({
  page
}) => {
  await page.goto("/app/digest");
  await expect(page.getByTestId("digest-manual-refresh")).toHaveText("更新日报");
  await expect(page.getByTestId("digest-window-1d")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("digest-window-3d")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("digest-window-7d")).toHaveAttribute("aria-pressed", "false");

  await page.getByTestId("digest-window-7d").click();
  await expect(page.getByTestId("digest-window-1d")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("digest-window-3d")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("digest-window-7d")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("digest-tab-do").click();

  await expect(page).toHaveURL(/tab=do/);
  await expect(page).toHaveURL(/window=7/);

  await page.getByTestId("nav-settings").click();
  await expect(page).toHaveURL("/app/settings");
  await page.goBack();

  await expect(page).toHaveURL(/\/app\/digest/);
  await expect(page).toHaveURL(/tab=do/);
  await expect(page).toHaveURL(/window=7/);
  await expect(page.getByTestId("digest-tab-do")).toHaveClass(/tabActive/);
  await expect(page.getByTestId("digest-window-1d")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("digest-window-3d")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("digest-window-7d")).toHaveAttribute("aria-pressed", "true");
});

test("M13 path: 7-day digest snapshot persists after navigating to memory and back via nav", async ({
  page
}) => {
  await page.goto("/app/digest");
  await page.getByTestId("digest-window-7d").click();
  await expect(page).toHaveURL(/window=7/);
  await expect(page.getByTestId("digest-window-1d")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("digest-window-3d")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("digest-window-7d")).toHaveAttribute("aria-pressed", "true");

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/api/digest/${todayDateKey()}/manual-refresh`) &&
        response.request().method() === "POST"
    ),
    page.getByTestId("digest-manual-refresh").click()
  ]);

  await expect(page.getByText("Digest State Signal A", { exact: true })).toBeVisible();
  await expect(page.getByTestId("digest-window-1d")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("digest-window-3d")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("digest-window-7d")).toHaveAttribute("aria-pressed", "true");
  const stateBeforeNav = await page.evaluate(() => window.sessionStorage.getItem("fomo.digest.view-state"));
  expect(stateBeforeNav).toContain("\"windowDays\":7");

  await page.getByTestId("nav-memory").click();
  await expect(page).toHaveURL("/app/cards");
  const stateOnCards = await page.evaluate(() => window.sessionStorage.getItem("fomo.digest.view-state"));
  expect(stateOnCards).toContain("\"windowDays\":7");
  await page.getByTestId("nav-digest").click();

  await expect(page).toHaveURL(/\/app\/digest/);
  const stateAfterReturn = await page.evaluate(() =>
    window.sessionStorage.getItem("fomo.digest.view-state")
  );
  expect(stateAfterReturn).toContain("\"windowDays\":7");
  await expect(page.getByText("加载日报中...")).toBeHidden({ timeout: 10000 });
  await expect(page).toHaveURL(/window=7/);
  await expect(page.getByTestId("digest-window-1d")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("digest-window-3d")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("digest-window-7d")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Digest State Signal A", { exact: true })).toBeVisible();
});

function todayDateKey() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

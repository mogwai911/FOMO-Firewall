import { expect, test } from "@playwright/test";
import { resetAppData, seedSignalForToday } from "./fixtures/db-seed";

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

test.beforeEach(async () => {
  await resetAppData();
  await seedSignalForToday({
    sourceName: "Manual Refresh Source",
    signalTitle: "Manual Refresh Signal",
    withTriage: false
  });
});

test("M11 path: digest supports manual refresh with overwrite confirms", async ({ page }) => {
  await page.goto("/app/digest");
  await expect(page.getByTestId("digest-manual-refresh")).toBeVisible();

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(`/api/digest/${todayDateKey()}/manual-refresh`) &&
        response.ok()
    ),
    page.getByTestId("digest-manual-refresh").click()
  ]);

  await expect(page.getByTestId("digest-refresh-summary")).toContainText("抓取源");
  const secondRefreshResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/api/digest/${todayDateKey()}/manual-refresh`) &&
      response.ok()
  );
  await page.getByTestId("digest-manual-refresh").click();
  await expect(page.getByTestId("confirm-modal")).toBeVisible();
  await expect(page.getByTestId("confirm-modal-title")).toContainText("覆盖更新");
  await page.getByTestId("confirm-modal-confirm").click();
  await expect(page.getByTestId("confirm-modal")).toBeVisible();
  await expect(page.getByTestId("confirm-modal-title")).toContainText("处置状态");
  await page.getByTestId("confirm-modal-cancel").click();
  await secondRefreshResponse;

  await expect(page.getByText("Manual Refresh Signal").first()).toBeVisible();
});

test("M11 path: manual refresh cancel on overwrite modal should not send refresh request", async ({
  page
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

  let refreshRequestCount = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes(`/api/digest/${todayDateKey()}/manual-refresh`)
    ) {
      refreshRequestCount += 1;
    }
  });

  await page.getByTestId("digest-manual-refresh").click();
  await expect(page.getByTestId("confirm-modal")).toBeVisible();
  await page.getByTestId("confirm-modal-cancel").click();
  await expect(page.getByTestId("confirm-modal")).toHaveCount(0);
  expect(refreshRequestCount).toBe(0);
});

test("M11 path: manual refresh from do tab returns to pending and shows digest counts", async ({
  page
}) => {
  await page.goto("/app/digest");
  await page.getByTestId("digest-tab-do").click();
  await expect(page.getByText("当前范围未生成日报")).toBeVisible();

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(`/api/digest/${todayDateKey()}/manual-refresh`) &&
        response.ok()
    ),
    page.getByTestId("digest-manual-refresh").click()
  ]);

  await expect(page.getByTestId("digest-refresh-summary")).toContainText("总量");
  await expect(page.getByTestId("digest-refresh-summary")).toContainText("待处理");
  await expect(page.getByText("Manual Refresh Signal").first()).toBeVisible();
});

test("M11 path: manual refresh supports 3-day/7-day history windows", async ({ page }) => {
  await page.goto("/app/digest");
  await expect(page.getByText("加载日报中...")).toHaveCount(0);
  let writeRequests = 0;
  let digestReadRequests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      (request.url().includes("/manual-refresh") || request.url().includes("/generate"))
    ) {
      writeRequests += 1;
    }
    if (
      request.method() === "GET" &&
      request.url().includes(`/api/digest/${todayDateKey()}`) &&
      !request.url().includes("/status")
    ) {
      digestReadRequests += 1;
    }
  });
  digestReadRequests = 0;

  await page.getByTestId("digest-window-7d").click();
  await expect(page).toHaveURL(/window=7/);
  expect(writeRequests).toBe(0);
  expect(digestReadRequests).toBe(0);

  let requestBody: Record<string, unknown> | null = null;
  await Promise.all([
    page.waitForRequest((request) => {
      if (
        request.method() !== "POST" ||
        !request.url().includes(`/api/digest/${todayDateKey()}/manual-refresh`)
      ) {
        return false;
      }
      requestBody = request.postDataJSON() as Record<string, unknown>;
      return true;
    }),
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(`/api/digest/${todayDateKey()}/manual-refresh`) &&
        response.ok()
    ),
    page.getByTestId("digest-manual-refresh").click()
  ]);

  expect(requestBody?.windowDays).toBe(7);
  await expect(page.getByTestId("digest-refresh-summary")).toContainText("近7天");
});

test("M11 path: refresh summary can be manually closed", async ({ page }) => {
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
  await expect(page.getByTestId("digest-refresh-summary")).toBeVisible();
  await page.getByTestId("digest-refresh-summary-close").click();
  await expect(page.getByTestId("digest-refresh-summary")).toBeHidden();
});

import { expect, test } from "@playwright/test";
import { resetAppData, seedSignalForToday } from "./fixtures/db-seed";

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

test.beforeEach(async () => {
  await resetAppData();
  await seedSignalForToday({
    signalTitle: "Digest AI Summary Signal",
    summary: "原始摘要：应被 AI 总结替换。"
  });
});

test("M16 path: digest cards prefetch ai summary without opening drawer", async ({ page }) => {
  await page.route(/\/api\/signals\/[^/]+\/preview$/, async (route) => {
    const url = route.request().url();
    const match = url.match(/\/api\/signals\/([^/]+)\/preview$/);
    const signalId = match?.[1] ?? "unknown";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        preview: {
          signalId,
          title: "Digest AI Summary Signal",
          sourceName: "Test Source",
          originalUrl: "https://example.com/post",
          aiSummary: "自动预加载的AI总结：不打开处置详情也应显示。",
          aiSummaryMode: "LLM",
          articleContent: null,
          warnings: [],
          generatedAt: new Date().toISOString()
        }
      })
    });
  });

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

  await page.waitForResponse((response) => {
    return (
      response.request().method() === "GET" &&
      /\/api\/signals\/[^/]+\/preview$/.test(response.url()) &&
      response.ok()
    );
  });

  const firstCard = page.getByTestId(/signal-.+/).first();
  await expect(firstCard.getByText("自动预加载的AI总结：不打开处置详情也应显示。")).toBeVisible();
});

test("M16 path: preview api should return stable generatedAt on repeated calls (cache hit)", async ({
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

  const firstCard = page.getByTestId(/signal-.+/).first();
  const cardId = await firstCard.getAttribute("data-testid");
  const signalId = cardId?.replace(/^signal-/, "");
  expect(signalId).toBeTruthy();

  const firstPreviewResponse = await page.request.get(`/api/signals/${signalId}/preview`);
  expect(firstPreviewResponse.ok()).toBeTruthy();
  const firstPreview = (await firstPreviewResponse.json()) as { preview: { generatedAt: string } };

  const secondPreviewResponse = await page.request.get(`/api/signals/${signalId}/preview`);
  expect(secondPreviewResponse.ok()).toBeTruthy();
  const secondPreview = (await secondPreviewResponse.json()) as { preview: { generatedAt: string } };

  expect(firstPreview.preview.generatedAt).toBe(secondPreview.preview.generatedAt);
});

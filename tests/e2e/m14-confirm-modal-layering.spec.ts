import { expect, test } from "@playwright/test";
import { resetAppData, seedSignalForToday } from "./fixtures/db-seed";

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

test.beforeEach(async () => {
  await resetAppData();
  await seedSignalForToday({
    sourceName: "Modal Layer Source",
    signalTitle: "Modal Layer Signal",
    withTriage: true
  });
});

test("M14 path: confirm modal should stay above drawer and centered in viewport", async ({
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

  await page.getByTestId(/signal-reason-.+/).first().click();
  await expect(page.getByTestId("digest-drawer")).toBeVisible();

  await page.getByTestId("digest-drawer").getByRole("button", { name: "去学习" }).click();

  const modal = page.getByTestId("confirm-modal");
  await expect(modal).toBeVisible();
  await expect(page.getByTestId("confirm-modal-panel")).toBeVisible();

  const diagnostics = await page.evaluate(() => {
    const modalEl = document.querySelector<HTMLElement>('[data-testid="confirm-modal"]');
    const panelEl = document.querySelector<HTMLElement>('[data-testid="confirm-modal-panel"]');
    const drawerOverlayEl = document.querySelector<HTMLElement>('[data-testid="digest-drawer-overlay"]');
    const panelRect = panelEl?.getBoundingClientRect();

    return {
      modalParentTag: modalEl?.parentElement?.tagName ?? null,
      modalZIndex: Number.parseInt(getComputedStyle(modalEl ?? document.body).zIndex || "0", 10),
      drawerZIndex: Number.parseInt(getComputedStyle(drawerOverlayEl ?? document.body).zIndex || "0", 10),
      panelWithinViewport: Boolean(
        panelRect &&
          panelRect.top >= 0 &&
          panelRect.left >= 0 &&
          panelRect.bottom <= window.innerHeight &&
          panelRect.right <= window.innerWidth
      )
    };
  });

  expect(diagnostics.modalParentTag).toBe("BODY");
  expect(diagnostics.modalZIndex).toBeGreaterThan(diagnostics.drawerZIndex);
  expect(diagnostics.panelWithinViewport).toBe(true);
});

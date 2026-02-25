import { expect, test } from "@playwright/test";
import { resetAppData, seedSignalForToday } from "./fixtures/db-seed";

test.beforeEach(async () => {
  await resetAppData();
});

test("M12 path: session home lists recent resumable sessions", async ({ page, request }) => {
  const first = await seedSignalForToday({
    signalTitle: "Session List Signal A",
    triageHeadline: "AI总结A：这是第一条会话线索。"
  });
  const second = await seedSignalForToday({
    signalTitle: "Session List Signal B",
    triageHeadline: "AI总结B：这是第二条会话线索。"
  });

  await request.post("/api/sessions", {
    data: {
      signalId: first.signalId
    }
  });
  await request.post("/api/sessions", {
    data: {
      signalId: second.signalId
    }
  });

  await page.goto("/app/session");
  await expect(page.getByTestId("session-home-list")).toBeVisible();
  await expect(page.getByRole("heading", { name: "学习会话" })).toBeVisible();
  await expect(page.getByTestId("session-home-quick-actions")).toHaveCount(0);
  await expect(page.getByText("Session List Signal A")).toBeVisible();
  await expect(page.getByText("Session List Signal B")).toBeVisible();
  await expect(page.getByText("AI总结A：这是第一条会话线索。")).toBeVisible();
  await expect(page.getByText("AI总结B：这是第二条会话线索。")).toBeVisible();
  await expect(page.getByRole("button", { name: "删除会话" })).toHaveCount(2);

  await page.getByTestId(/session-delete-.+/).first().click();
  await expect(page.getByTestId("confirm-modal")).toBeVisible();
  await page.getByTestId("confirm-modal-confirm").click();
  await expect(page.getByRole("button", { name: "删除会话" })).toHaveCount(1);

  await page.getByTestId("nav-digest").click();
  await expect(page).toHaveURL("/app/digest");
  await page.getByTestId("nav-session").click();
  await expect(page).toHaveURL("/app/session");

  await page.getByTestId("nav-memory").click();
  await expect(page).toHaveURL("/app/cards");
  await page.getByTestId("nav-session").click();
  await expect(page).toHaveURL("/app/session");

  await page.getByTestId("nav-settings").click();
  await expect(page).toHaveURL("/app/settings");
});

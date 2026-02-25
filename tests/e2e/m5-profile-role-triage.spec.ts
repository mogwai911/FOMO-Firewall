import { expect, test } from "@playwright/test";
import { resetAppData, seedSignalForToday } from "./fixtures/db-seed";

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

test.beforeEach(async () => {
  await resetAppData();
  await seedSignalForToday({
    sourceName: "Role Source",
    signalTitle: "Role-aware signal",
    summary: "Includes release and migration details.",
    withTriage: false
  });
});

test("M5 path: settings role drives triage wording", async ({ page }) => {
  await page.goto("/app/settings");

  await page.getByLabel("用户角色").selectOption("PM");
  await expect(page.getByLabel("用户角色")).toHaveValue("PM");
  await page.getByRole("button", { name: "保存角色偏好" }).click();
  await expect(page.getByText("角色偏好已保存")).toBeVisible();

  const profileRes = await page.request.get("/api/profile");
  const profileJson = await profileRes.json();
  expect(profileJson.role).toBe("PM");

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
  await expect(page.getByText("优先评估对路线图与交付节奏的影响")).toBeVisible();
});

import { expect, test } from "@playwright/test";
import { resetAppData, seedSignalForToday } from "./fixtures/db-seed";
import { resolveLlmE2EEnv } from "../../src/lib/ops/llm-gate-env";

const llmEnv = resolveLlmE2EEnv({
  LLM_E2E_BASE_URL: process.env.LLM_E2E_BASE_URL,
  LLM_E2E_API_KEY: process.env.LLM_E2E_API_KEY
});

test.beforeEach(async () => {
  await resetAppData();
  await seedSignalForToday({
    sourceName: "LLM Stream Source",
    signalTitle: "LLM Stream Signal",
    summary: "请给出可执行步骤。"
  });
});

test("M10 path: DO -> session -> real llm stream -> persisted assistant reply", async ({ page }) => {
  test.skip(!llmEnv.ok, "requires valid LLM_E2E_BASE_URL and LLM_E2E_API_KEY");
  if (!llmEnv.ok) {
    return;
  }

  async function saveSettings(buttonName: string): Promise<void> {
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("/api/settings") &&
          response.ok()
      ),
      page.getByRole("button", { name: buttonName }).click()
    ]);
  }

  await page.goto("/app/settings");
  await page.getByRole("button", { name: "LLM 接入" }).click();
  await page.getByPlaceholder("LLM Base URL").fill(llmEnv.value.baseUrl);
  await page.getByPlaceholder(/LLM API Key/).fill(llmEnv.value.apiKey);
  await saveSettings("保存 LLM 配置");

  await page.goto("/app/digest");
  const signalCard = page.getByTestId(/signal-.+/).first();
  await signalCard.getByTestId(/do-.+/).click();
  await expect(page.getByTestId("confirm-modal")).toBeVisible();
  await page.getByTestId("confirm-modal-confirm").click();

  await expect(page).toHaveURL(/\/app\/session\//);

  const question = "请给我一个三步执行计划";
  await page.getByTestId("session-input").fill(question);
  await page.getByTestId("session-send").click();

  await expect(page.getByText(`你：${question}`)).toBeVisible();
  await expect(page.getByTestId("session-streaming-assistant")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("session-streaming-assistant")).toBeHidden({ timeout: 90000 });

  await expect(page.getByText(/助手：/).first()).toBeVisible({ timeout: 90000 });
  await expect(page.getByText(/LLM_/)).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(`你：${question}`)).toBeVisible();
  await expect(page.getByText(/助手：/).first()).toBeVisible();
});

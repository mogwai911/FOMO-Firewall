import { expect, test } from "@playwright/test";
import { resetAppData } from "./fixtures/db-seed";

test.beforeEach(async () => {
  await resetAppData();
});

test("M8 path: settings persist in DB and RSS source CRUD survives refresh", async ({
  page
}) => {
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

  async function addRssSource(): Promise<void> {
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("/api/sources") &&
          response.ok()
      ),
      page.getByRole("button", { name: "添加订阅源" }).click()
    ]);
  }

  await page.goto("/app/settings");
  await expect(page.getByTestId("settings-quick-actions")).toHaveCount(0);
  await expect(page.getByTestId("settings-section-nav")).toBeVisible();

  await page.getByRole("button", { name: "订阅源" }).click();
  await page.getByPlaceholder("RSS URL（必填）").fill("https://example.com/rss.xml");
  await page.getByPlaceholder("显示名称（可选）").fill("Example RSS");
  await page.getByPlaceholder("标签（可选，逗号分隔）").fill("ai,weekly");
  await addRssSource();
  await expect(page.getByText("Example RSS")).toBeVisible();

  await page.getByRole("button", { name: "日报定时" }).click();
  await page.getByLabel("启用日报").check();
  await page.getByLabel("触发时间").fill("08:30");
  await saveSettings("保存定时");

  await page.getByRole("button", { name: "LLM 接入" }).click();
  await page.getByPlaceholder("LLM Base URL").fill("https://api.example.com");
  await saveSettings("保存 LLM 配置");

  await page.getByRole("button", { name: "提示词" }).click();
  await page.getByLabel("分流提示词").fill("你是严谨的分流助手，优先可执行性。");
  await page.getByLabel("学习助手提示词").fill("语气简洁，优先给出三步计划。");
  await saveSettings("保存提示词");

  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: "日报定时" }).click();
  await expect(page.getByLabel("启用日报")).toBeChecked();
  await expect(page.getByLabel("触发时间")).toHaveValue("08:30");

  await page.getByRole("button", { name: "LLM 接入" }).click();
  await expect(page.getByPlaceholder("LLM Base URL")).toHaveValue("https://api.example.com");

  await page.getByRole("button", { name: "提示词" }).click();
  await expect(page.getByLabel("分流提示词")).toHaveValue("你是严谨的分流助手，优先可执行性。");
  await expect(page.getByLabel("学习助手提示词")).toHaveValue("语气简洁，优先给出三步计划。");

  await page.getByRole("button", { name: "订阅源" }).click();
  await expect(page.getByText("Example RSS")).toBeVisible();

  await page.getByTestId("nav-digest").click();
  await expect(page).toHaveURL("/app/digest");
  await page.getByTestId("nav-settings").click();
  await expect(page).toHaveURL("/app/settings");
});

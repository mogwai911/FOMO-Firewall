import { defineConfig } from "@playwright/test";

const e2ePort = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const baseURL = `http://localhost:${e2ePort}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL,
    trace: "on-first-retry"
  },
  webServer: {
    command: `npm run dev -- --port ${e2ePort}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});

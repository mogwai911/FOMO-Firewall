import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { disconnectSeedClient, resetAppData, seedSignalForToday } from "./fixtures/db-seed";

const prisma = new PrismaClient();

function nowUtcTimeHHmm(): string {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

test.beforeEach(async () => {
  await resetAppData();
});

test.afterAll(async () => {
  await resetAppData();
  await prisma.$disconnect();
  await disconnectSeedClient();
});

test("M9 path: schedule tick runs once and is idempotent per day", async ({ request }) => {
  await seedSignalForToday({
    signalTitle: "Scheduler Seed Signal"
  });

  await prisma.appSettings.upsert({
    where: {
      id: "default"
    },
    create: {
      id: "default",
      scheduleEnabled: true,
      scheduleTime: nowUtcTimeHHmm(),
      timezone: "UTC",
      apiBaseUrl: "",
      apiKey: "",
      lastScheduleRunAt: null
    },
    update: {
      scheduleEnabled: true,
      scheduleTime: nowUtcTimeHHmm(),
      timezone: "UTC",
      lastScheduleRunAt: null
    }
  });

  const first = await request.post("/api/jobs/schedule_tick");
  expect(first.ok()).toBeTruthy();
  const firstJson = (await first.json()) as { status: string };
  expect(firstJson.status).toBe("RAN");

  const second = await request.post("/api/jobs/schedule_tick");
  expect(second.ok()).toBeTruthy();
  const secondJson = (await second.json()) as { status: string };
  expect(secondJson.status).toBe("SKIPPED_ALREADY_RAN");
});

import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { disconnectSeedClient, resetAppData, seedSignalForToday } from "./fixtures/db-seed";

const prisma = new PrismaClient();

test.beforeEach(async () => {
  await resetAppData();
});

test.afterAll(async () => {
  await resetAppData();
  await prisma.$disconnect();
  await disconnectSeedClient();
});

test("M6 path: disposition/session/jobs/triage-expanded events are recorded", async ({ request }) => {
  const seeded = await seedSignalForToday();

  const dispositionRes = await request.post(
    `/api/signals/${seeded.signalId}/disposition`,
    {
      data: {
        label: "DO"
      }
    }
  );
  expect(dispositionRes.ok()).toBeTruthy();

  const sessionRes = await request.post("/api/sessions", {
    data: {
      signalId: seeded.signalId
    }
  });
  expect(sessionRes.ok()).toBeTruthy();
  const sessionJson = (await sessionRes.json()) as { session: { id: string } };
  const sessionId = sessionJson.session.id;

  const jobRes = await request.post(`/api/sessions/${sessionId}/jobs`, {
    data: {
      type: "INSIGHT_CARD",
      runNow: false
    }
  });
  expect(jobRes.status()).toBe(202);
  const jobJson = (await jobRes.json()) as { job: { id: string } };
  const jobId = jobJson.job.id;

  const reasonRes = await request.post(`/api/signals/${seeded.signalId}/events`, {
    data: {
      type: "TRIAGE_EXPANDED",
      payloadJson: {
        source: "digest"
      }
    }
  });
  expect(reasonRes.ok()).toBeTruthy();

  const events = await prisma.eventLogV2.findMany({
    where: {
      signalId: seeded.signalId
    },
    orderBy: {
      createdAt: "asc"
    },
    select: {
      type: true,
      sessionId: true,
      jobId: true
    }
  });

  expect(events.map((item) => item.type)).toEqual(
    expect.arrayContaining([
      "DISPOSITION_SET",
      "SESSION_ENTERED",
      "JOB_ENQUEUED",
      "TRIAGE_EXPANDED"
    ])
  );
  expect(events.some((item) => item.jobId === jobId)).toBe(true);
});

import { expect, test } from "@playwright/test";
import { resetAppData, seedSignalForToday } from "./fixtures/db-seed";

test.beforeEach(async () => {
  await resetAppData();
});

test("M3 real capability path: disposition/session/jobs/cards/evidence APIs", async ({ request }) => {
  const seeded = await seedSignalForToday({
    signalTitle: "M3 Signal"
  });

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

  const msgRes = await request.post(`/api/sessions/${sessionId}/messages`, {
    data: {
      role: "user",
      content: "帮我梳理这个更新"
    }
  });
  expect(msgRes.ok()).toBeTruthy();

  const insightJobRes = await request.post(`/api/sessions/${sessionId}/jobs`, {
    data: {
      type: "INSIGHT_CARD"
    }
  });
  expect(insightJobRes.ok()).toBeTruthy();

  const evidenceJobRes = await request.post(`/api/sessions/${sessionId}/jobs`, {
    data: {
      type: "EVIDENCE_PACK"
    }
  });
  expect(evidenceJobRes.ok()).toBeTruthy();

  await expect
    .poll(
      async () => {
        const cardsRes = await request.get(`/api/insight_cards?sessionId=${sessionId}`);
        if (!cardsRes.ok()) return 0;
        const cardsJson = (await cardsRes.json()) as { cards: Array<{ id: string }> };
        return cardsJson.cards.length;
      },
      { timeout: 12000 }
    )
    .toBeGreaterThan(0);

  await expect
    .poll(
      async () => {
        const packsRes = await request.get(`/api/evidence_packs?sessionId=${sessionId}`);
        if (!packsRes.ok()) return 0;
        const packsJson = (await packsRes.json()) as { packs: Array<{ id: string }> };
        return packsJson.packs.length;
      },
      { timeout: 12000 }
    )
    .toBeGreaterThan(0);

  const packsRes = await request.get(`/api/evidence_packs?sessionId=${sessionId}`);
  const packsJson = (await packsRes.json()) as { packs: Array<{ id: string }> };
  const packDetailRes = await request.get(`/api/evidence_packs/${packsJson.packs[0].id}`);
  expect(packDetailRes.ok()).toBeTruthy();
});

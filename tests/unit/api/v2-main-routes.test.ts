import { describe, expect, it, vi } from "vitest";
import { createDigestGeneratePostHandler } from "@/app/api/digest/[date]/generate/route";
import { createSignalTriagePostHandler } from "@/app/api/signals/[id]/triage/route";
import { createSessionsPostHandler } from "@/app/api/sessions/route";
import { createSessionMessagesPostHandler } from "@/app/api/sessions/[id]/messages/route";
import { createSessionJobsPostHandler } from "@/app/api/sessions/[id]/jobs/route";
import { createInsightCardsGetHandler } from "@/app/api/insight_cards/route";
import { createEvidencePacksGetHandler } from "@/app/api/evidence_packs/route";

describe("v2 main routes", () => {
  it("POST /api/digest/:date/generate forwards params and body", async () => {
    const generateDigest = vi.fn().mockResolvedValue({
      dateKey: "2026-02-20",
      count: 1,
      signals: []
    });

    const handler = createDigestGeneratePostHandler({ generateDigest } as any);
    const req = new Request("http://localhost/api/digest/2026-02-20/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit: 10, role: "ENG", windowDays: 3 })
    });

    const res = await handler(req, { params: Promise.resolve({ date: "2026-02-20" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(generateDigest).toHaveBeenCalledWith({
      dateKey: "2026-02-20",
      limit: 10,
      role: "ENG",
      windowDays: 3
    });
    expect(json.count).toBe(1);
  });

  it("POST /api/signals/:id/triage validates role", async () => {
    const generateTriage = vi.fn();
    const handler = createSignalTriagePostHandler({ generateTriage } as any);
    const req = new Request("http://localhost/api/signals/sig-1/triage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "INVALID" })
    });

    const res = await handler(req, { params: Promise.resolve({ id: "sig-1" }) });
    expect(res.status).toBe(400);
    expect(generateTriage).not.toHaveBeenCalled();
  });

  it("POST /api/digest/:date/generate validates windowDays", async () => {
    const generateDigest = vi.fn();
    const handler = createDigestGeneratePostHandler({ generateDigest } as any);
    const req = new Request("http://localhost/api/digest/2026-02-20/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ windowDays: 6 })
    });

    const res = await handler(req, { params: Promise.resolve({ date: "2026-02-20" }) });

    expect(res.status).toBe(400);
    expect(generateDigest).not.toHaveBeenCalled();
  });

  it("POST /api/sessions creates or resumes session", async () => {
    const createOrResumeSession = vi.fn().mockResolvedValue({
      id: "session-1",
      signalId: "sig-1",
      status: "ACTIVE"
    });
    const handler = createSessionsPostHandler({ createOrResumeSession } as any);
    const req = new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signalId: "sig-1" })
    });

    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(createOrResumeSession).toHaveBeenCalledWith({ signalId: "sig-1" });
    expect(json.session.id).toBe("session-1");
  });

  it("POST /api/sessions/:id/messages validates content", async () => {
    const appendSessionMessage = vi.fn();
    const handler = createSessionMessagesPostHandler({ appendSessionMessage } as any);
    const req = new Request("http://localhost/api/sessions/session-1/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "user", content: "" })
    });

    const res = await handler(req, { params: Promise.resolve({ id: "session-1" }) });
    expect(res.status).toBe(400);
    expect(appendSessionMessage).not.toHaveBeenCalled();
  });

  it("POST /api/sessions/:id/jobs validates type", async () => {
    const enqueueJob = vi.fn();
    const runJob = vi.fn();
    const dispatchJob = vi.fn();
    const handler = createSessionJobsPostHandler({ enqueueJob, runJob, dispatchJob } as any);
    const req = new Request("http://localhost/api/sessions/session-1/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "INVALID" })
    });

    const res = await handler(req, { params: Promise.resolve({ id: "session-1" }) });
    expect(res.status).toBe(400);
    expect(enqueueJob).not.toHaveBeenCalled();
    expect(runJob).not.toHaveBeenCalled();
    expect(dispatchJob).not.toHaveBeenCalled();
  });

  it("POST /api/sessions/:id/jobs enqueues and dispatches by default", async () => {
    const enqueueJob = vi.fn().mockResolvedValue({ id: "job-1" });
    const runJob = vi.fn().mockResolvedValue({
      id: "job-1",
      status: "DONE"
    });
    const dispatchJob = vi.fn();

    const handler = createSessionJobsPostHandler({ enqueueJob, runJob, dispatchJob } as any);
    const req = new Request("http://localhost/api/sessions/session-1/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "INSIGHT_CARD" })
    });

    const res = await handler(req, { params: Promise.resolve({ id: "session-1" }) });
    const json = await res.json();

    expect(res.status).toBe(202);
    expect(enqueueJob).toHaveBeenCalledWith({ sessionId: "session-1", type: "INSIGHT_CARD" });
    expect(dispatchJob).toHaveBeenCalledWith("job-1");
    expect(runJob).not.toHaveBeenCalled();
    expect(json.job.id).toBe("job-1");
  });

  it("POST /api/sessions/:id/jobs supports runNow for synchronous execution", async () => {
    const enqueueJob = vi.fn().mockResolvedValue({
      id: "job-2",
      sessionId: "session-1",
      type: "INSIGHT_CARD",
      status: "QUEUED",
      resultRefJson: null,
      updatedAt: "2026-02-20T00:00:00.000Z"
    });
    const runJob = vi.fn().mockResolvedValue({
      id: "job-2",
      status: "DONE",
      resultRefJson: {
        insightCardIds: ["card-1"]
      }
    });
    const dispatchJob = vi.fn();

    const handler = createSessionJobsPostHandler({ enqueueJob, runJob, dispatchJob } as any);
    const req = new Request("http://localhost/api/sessions/session-1/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "INSIGHT_CARD", runNow: true })
    });

    const res = await handler(req, { params: Promise.resolve({ id: "session-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(runJob).toHaveBeenCalledWith("job-2");
    expect(dispatchJob).not.toHaveBeenCalled();
    expect(json.job.status).toBe("DONE");
  });

  it("GET /api/insight_cards forwards query", async () => {
    const listInsightCards = vi.fn().mockResolvedValue([{ id: "card-1" }]);
    const handler = createInsightCardsGetHandler({ listInsightCards } as any);
    const req = new Request("http://localhost/api/insight_cards?sessionId=session-1&limit=10");

    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(listInsightCards).toHaveBeenCalledWith({
      sessionId: "session-1",
      limit: 10
    });
    expect(json.cards).toHaveLength(1);
  });

  it("GET /api/evidence_packs forwards query", async () => {
    const listEvidencePacks = vi.fn().mockResolvedValue([{ id: "pack-1" }]);
    const handler = createEvidencePacksGetHandler({ listEvidencePacks } as any);
    const req = new Request("http://localhost/api/evidence_packs?sessionId=session-1&limit=10");

    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(listEvidencePacks).toHaveBeenCalledWith({
      sessionId: "session-1",
      limit: 10
    });
    expect(json.packs).toHaveLength(1);
  });
});

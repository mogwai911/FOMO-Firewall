import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMockState, mockActions } from "@/lib/mockStore";

describe("M2 async deposit loop with mock jobs", () => {
  beforeEach(() => {
    mockActions.reset();
    vi.useRealTimers();
  });

  it("generates flashcards and evidence through job lifecycle", () => {
    vi.useFakeTimers();

    const sessionId = mockActions.getOrCreateSessionForSignal("signal-alpha");
    mockActions.enterSession(sessionId);
    mockActions.sendUserMessage(sessionId, "给我一个最小学习路径");

    const jobId = mockActions.startJob(sessionId, "flashcards");
    let state = getMockState();
    let job = state.jobs.find((item) => item.id === jobId);
    expect(job?.status).toBe("queued");

    vi.advanceTimersByTime(400);
    state = getMockState();
    job = state.jobs.find((item) => item.id === jobId);
    expect(job?.status).toBe("running");

    vi.advanceTimersByTime(1300);
    state = getMockState();
    job = state.jobs.find((item) => item.id === jobId);
    expect(job?.status).toBe("done");

    const cards = state.memoryCards.filter((item) => item.sessionId === sessionId);
    const evidence = state.evidencePacks.find((item) => item.sessionId === sessionId);

    expect(cards.length).toBeGreaterThanOrEqual(3);
    expect(cards.length).toBeLessThanOrEqual(5);
    expect(evidence).toBeDefined();
    expect(cards.every((item) => item.evidenceId)).toBe(true);
  });

  it("keeps session traceability from generated artifacts", () => {
    vi.useFakeTimers();

    const sessionId = mockActions.getOrCreateSessionForSignal("signal-alpha");
    const evidenceJobId = mockActions.startJob(sessionId, "evidence");

    vi.advanceTimersByTime(1800);

    const state = getMockState();
    const evidenceJob = state.jobs.find((item) => item.id === evidenceJobId);
    const evidence = state.evidencePacks.find((item) => item.id === evidenceJob?.resultId);

    expect(evidenceJob?.status).toBe("done");
    expect(evidence?.sessionId).toBe(sessionId);
    expect(evidence?.signalId).toBe("signal-alpha");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMockState, mockActions } from "@/lib/mockStore";

describe("M1 disposition/session loop", () => {
  beforeEach(() => {
    mockActions.reset();
    vi.useRealTimers();
  });

  it("creates one session for a DO signal and reuses it", () => {
    mockActions.setDisposition("signal-alpha", "DO");

    const first = getMockState();
    expect(first.dispositions["signal-alpha"]).toBe("DO");
    expect(first.sessions).toHaveLength(1);
    expect(first.sessions[0]?.id).toBe("session-signal-alpha");

    mockActions.setDisposition("signal-alpha", "DO");
    const sessionId = mockActions.getOrCreateSessionForSignal("signal-alpha");

    const second = getMockState();
    expect(sessionId).toBe("session-signal-alpha");
    expect(second.sessions).toHaveLength(1);
  });

  it("autosaves messages and keeps history after pause/resume", () => {
    vi.useFakeTimers();

    const sessionId = mockActions.getOrCreateSessionForSignal("signal-alpha");
    mockActions.enterSession(sessionId);
    mockActions.sendUserMessage(sessionId, "解释一下这条线索");

    const immediate = getMockState();
    const userMessages = immediate.sessionMessages.filter((item) => item.sessionId === sessionId);
    expect(userMessages).toHaveLength(1);
    expect(userMessages[0]?.role).toBe("user");

    vi.advanceTimersByTime(350);

    const withReply = getMockState();
    const allMessages = withReply.sessionMessages.filter((item) => item.sessionId === sessionId);
    expect(allMessages).toHaveLength(2);
    expect(allMessages[1]?.role).toBe("assistant");

    mockActions.pauseSession(sessionId);
    let afterPause = getMockState().sessions.find((item) => item.id === sessionId);
    expect(afterPause?.status).toBe("paused");

    mockActions.enterSession(sessionId);
    const afterResume = getMockState();
    const resumedSession = afterResume.sessions.find((item) => item.id === sessionId);
    const resumedMessages = afterResume.sessionMessages.filter((item) => item.sessionId === sessionId);

    expect(resumedSession?.status).toBe("active");
    expect(resumedMessages).toHaveLength(2);
  });
});

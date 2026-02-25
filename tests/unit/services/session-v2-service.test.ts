import { describe, expect, it, vi } from "vitest";
import {
  appendSessionMessage,
  createOrResumeSession,
  SessionServiceError
} from "@/lib/services/session-v2-service";

describe("session-v2-service", () => {
  it("resumes existing session when available", async () => {
    const deps = {
      findSignal: vi.fn().mockResolvedValue({ id: "sig-1" }),
      findLatestSession: vi.fn().mockResolvedValue({
        id: "session-1",
        signalId: "sig-1",
        status: "PAUSED",
        createdAt: new Date("2026-02-20T00:00:00.000Z"),
        updatedAt: new Date("2026-02-20T01:00:00.000Z")
      }),
      createSession: vi.fn(),
      updateSessionStatus: vi.fn().mockResolvedValue({
        id: "session-1",
        signalId: "sig-1",
        status: "ACTIVE",
        createdAt: new Date("2026-02-20T00:00:00.000Z"),
        updatedAt: new Date("2026-02-20T02:00:00.000Z")
      }),
      findSession: vi.fn(),
      createMessage: vi.fn(),
      recordEvent: vi.fn()
    };

    const out = await createOrResumeSession({ signalId: "sig-1" }, deps as any);

    expect(deps.updateSessionStatus).toHaveBeenCalledWith("session-1", "ACTIVE");
    expect(deps.recordEvent).toHaveBeenCalledWith({
      type: "SESSION_RESUMED",
      signalId: "sig-1",
      sessionId: "session-1",
      payloadJson: {
        resumedFromStatus: "PAUSED"
      }
    });
    expect(out.id).toBe("session-1");
    expect(out.status).toBe("ACTIVE");
  });

  it("creates a new session and records entered event", async () => {
    const deps = {
      findSignal: vi.fn().mockResolvedValue({ id: "sig-1" }),
      findLatestSession: vi.fn().mockResolvedValue(null),
      createSession: vi.fn().mockResolvedValue({
        id: "session-2",
        signalId: "sig-1",
        status: "ACTIVE",
        createdAt: new Date("2026-02-20T03:00:00.000Z"),
        updatedAt: new Date("2026-02-20T03:00:00.000Z")
      }),
      updateSessionStatus: vi.fn(),
      findSession: vi.fn(),
      createMessage: vi.fn(),
      recordEvent: vi.fn()
    };

    const out = await createOrResumeSession({ signalId: "sig-1" }, deps as any);

    expect(out.id).toBe("session-2");
    expect(deps.recordEvent).toHaveBeenCalledWith({
      type: "SESSION_ENTERED",
      signalId: "sig-1",
      sessionId: "session-2",
      payloadJson: {
        created: true
      }
    });
  });

  it("throws SIGNAL_NOT_FOUND when signal does not exist", async () => {
    const deps = {
      findSignal: vi.fn().mockResolvedValue(null),
      findLatestSession: vi.fn(),
      createSession: vi.fn(),
      updateSessionStatus: vi.fn(),
      findSession: vi.fn(),
      createMessage: vi.fn(),
      recordEvent: vi.fn()
    };

    await expect(createOrResumeSession({ signalId: "missing" }, deps as any)).rejects.toMatchObject({
      code: "SIGNAL_NOT_FOUND"
    } as SessionServiceError);
  });

  it("appends message with normalized role", async () => {
    const deps = {
      findSignal: vi.fn(),
      findLatestSession: vi.fn(),
      createSession: vi.fn(),
      updateSessionStatus: vi.fn().mockResolvedValue({
        id: "session-1",
        signalId: "sig-1",
        status: "ACTIVE",
        createdAt: new Date("2026-02-20T00:00:00.000Z"),
        updatedAt: new Date("2026-02-20T02:00:00.000Z")
      }),
      findSession: vi.fn().mockResolvedValue({ id: "session-1" }),
      createMessage: vi.fn().mockResolvedValue({
        id: "msg-1",
        sessionId: "session-1",
        role: "USER",
        content: "hello",
        metaJson: null,
        createdAt: new Date("2026-02-20T02:00:00.000Z")
      }),
      recordEvent: vi.fn()
    };

    const out = await appendSessionMessage(
      {
        sessionId: "session-1",
        role: "user",
        content: " hello "
      },
      deps as any
    );

    expect(deps.createMessage).toHaveBeenCalledWith({
      sessionId: "session-1",
      role: "USER",
      content: "hello",
      metaJson: undefined
    });
    expect(out.role).toBe("USER");
    expect(out.content).toBe("hello");
  });
});

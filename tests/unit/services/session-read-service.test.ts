import { describe, expect, it, vi } from "vitest";
import {
  deleteSessionById,
  getSessionDetail,
  listRecentSessions,
  SessionReadServiceError,
  updateSessionLifecycleStatus
} from "@/lib/services/session-read-service";

describe("session-read-service", () => {
  it("returns session details with messages and jobs", async () => {
    const deps = {
      findSessionDetail: vi.fn().mockResolvedValue({
        id: "session-1",
        status: "ACTIVE",
        createdAt: new Date("2026-02-20T00:00:00.000Z"),
        updatedAt: new Date("2026-02-20T01:00:00.000Z"),
        signal: {
          id: "sig-1",
          title: "OpenAI update",
          summary: "summary",
          url: "https://example.com/openai",
          source: {
            id: "src-1",
            name: "OpenAI Blog"
          }
        },
        messages: [
          {
            id: "msg-1",
            role: "USER",
            content: "hello",
            metaJson: null,
            createdAt: new Date("2026-02-20T01:10:00.000Z")
          }
        ],
        jobs: [
          {
            id: "job-1",
            type: "INSIGHT_CARD",
            status: "DONE",
            error: null,
            resultRefJson: { insightCardIds: ["card-1"] },
            createdAt: new Date("2026-02-20T01:00:00.000Z"),
            updatedAt: new Date("2026-02-20T01:20:00.000Z")
          }
        ]
      }),
      findSessionRef: vi.fn(),
      updateSessionStatus: vi.fn()
    };

    const out = await getSessionDetail("session-1", deps as any);

    expect(out.id).toBe("session-1");
    expect(out.signal.id).toBe("sig-1");
    expect(out.messages).toHaveLength(1);
    expect(out.jobs).toHaveLength(1);
  });

  it("throws SESSION_NOT_FOUND when missing", async () => {
    const deps = {
      findSessionDetail: vi.fn().mockResolvedValue(null),
      findSessionRef: vi.fn(),
      updateSessionStatus: vi.fn()
    };

    await expect(getSessionDetail("missing", deps as any)).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND"
    } as SessionReadServiceError);
  });

  it("updates lifecycle status with validation", async () => {
    const deps = {
      findSessionDetail: vi.fn(),
      findSessionRef: vi.fn().mockResolvedValue({ id: "session-1" }),
      updateSessionStatus: vi.fn().mockResolvedValue({
        id: "session-1",
        signalId: "sig-1",
        status: "PAUSED",
        createdAt: new Date("2026-02-20T00:00:00.000Z"),
        updatedAt: new Date("2026-02-20T01:30:00.000Z")
      })
    };

    const out = await updateSessionLifecycleStatus(
      {
        sessionId: "session-1",
        status: "PAUSED"
      },
      deps as any
    );

    expect(out.status).toBe("PAUSED");
    expect(deps.updateSessionStatus).toHaveBeenCalledWith("session-1", "PAUSED");
  });

  it("deletes session by id", async () => {
    const deps = {
      findSessionDetail: vi.fn(),
      findSessionRef: vi.fn().mockResolvedValue({ id: "session-1" }),
      updateSessionStatus: vi.fn(),
      deleteSession: vi.fn().mockResolvedValue({ id: "session-1" }),
      listSessions: vi.fn()
    };

    const out = await deleteSessionById("session-1", deps as any);

    expect(out).toEqual({ id: "session-1" });
    expect(deps.deleteSession).toHaveBeenCalledWith("session-1");
  });

  it("uses triage headline as ai summary in recent sessions list", async () => {
    const deps = {
      findSessionDetail: vi.fn(),
      findSessionRef: vi.fn(),
      updateSessionStatus: vi.fn(),
      deleteSession: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([
        {
          id: "session-2",
          status: "ACTIVE",
          createdAt: new Date("2026-02-20T00:00:00.000Z"),
          updatedAt: new Date("2026-02-20T01:00:00.000Z"),
          signal: {
            id: "sig-2",
            title: "title",
            summary: "fallback summary",
            source: {
              id: "src-2",
              name: "source"
            },
            triages: [
              {
                triageJson: {
                  label: "DO",
                  headline: "AI总结：更适合马上进入会话",
                  reasons: [],
                  snippets: [],
                  next_action_hint: "ENTER_SESSION",
                  score: 85
                }
              }
            ]
          },
          _count: {
            messages: 1
          }
        }
      ])
    };

    const out = await listRecentSessions({ limit: 20, statuses: ["ACTIVE"] }, deps as any);
    expect(out[0].signal.aiSummary).toBe("AI总结：更适合马上进入会话");
  });
});

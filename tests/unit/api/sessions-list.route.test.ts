import { describe, expect, it, vi } from "vitest";
import { createSessionsGetHandler } from "@/app/api/sessions/route";

describe("GET /api/sessions", () => {
  it("returns recent sessions with default statuses", async () => {
    const listSessions = vi.fn().mockResolvedValue([
      {
        id: "session-1",
        status: "PAUSED",
        updatedAt: "2026-02-21T09:00:00.000Z",
        messageCount: 3,
        signal: {
          id: "sig-1",
          title: "signal title",
          summary: "signal summary",
          source: {
            id: "source-1",
            name: "Source"
          }
        }
      }
    ]);
    const handler = createSessionsGetHandler({ listSessions } as any);

    const res = await handler(
      new Request("http://localhost/api/sessions?limit=10&status=ACTIVE,PAUSED")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(listSessions).toHaveBeenCalledWith({
      limit: 10,
      statuses: ["ACTIVE", "PAUSED"]
    });
    expect(json.sessions).toHaveLength(1);
  });

  it("returns 400 when limit is invalid", async () => {
    const listSessions = vi.fn();
    const handler = createSessionsGetHandler({ listSessions } as any);

    const res = await handler(new Request("http://localhost/api/sessions?limit=-1"));
    expect(res.status).toBe(400);
    expect(listSessions).not.toHaveBeenCalled();
  });
});

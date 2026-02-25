import { describe, expect, it, vi } from "vitest";
import { createSessionDeleteHandler, createSessionGetHandler } from "@/app/api/sessions/[id]/route";
import { createSessionStatusPostHandler } from "@/app/api/sessions/[id]/status/route";

describe("session detail and status routes", () => {
  it("GET /api/sessions/:id forwards id", async () => {
    const getSession = vi.fn().mockResolvedValue({
      id: "session-1",
      status: "ACTIVE",
      signal: { id: "sig-1" },
      messages: [],
      jobs: []
    });
    const handler = createSessionGetHandler({ getSession } as any);
    const req = new Request("http://localhost/api/sessions/session-1");

    const res = await handler(req, { params: Promise.resolve({ id: "session-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(getSession).toHaveBeenCalledWith("session-1");
    expect(json.session.id).toBe("session-1");
  });

  it("POST /api/sessions/:id/status validates status", async () => {
    const setStatus = vi.fn();
    const handler = createSessionStatusPostHandler({ setStatus } as any);
    const req = new Request("http://localhost/api/sessions/session-1/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "INVALID" })
    });

    const res = await handler(req, { params: Promise.resolve({ id: "session-1" }) });
    expect(res.status).toBe(400);
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("DELETE /api/sessions/:id forwards id", async () => {
    const deleteSession = vi.fn().mockResolvedValue({ id: "session-1" });
    const handler = createSessionDeleteHandler({ deleteSession } as any);
    const req = new Request("http://localhost/api/sessions/session-1", {
      method: "DELETE"
    });

    const res = await handler(req, { params: Promise.resolve({ id: "session-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(deleteSession).toHaveBeenCalledWith("session-1");
    expect(json.deleted.id).toBe("session-1");
  });
});

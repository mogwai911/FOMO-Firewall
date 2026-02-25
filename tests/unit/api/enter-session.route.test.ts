import { describe, expect, it, vi } from "vitest";
import { createSignalEnterSessionPostHandler } from "@/app/api/signals/[id]/enter-session/route";
import { SignalEnterSessionServiceError } from "@/lib/services/signal-enter-session-service";

describe("POST /api/signals/:id/enter-session", () => {
  it("sets DO disposition and returns resumed session", async () => {
    const enterSession = vi.fn().mockResolvedValue({
      disposition: {
        label: "DO"
      },
      session: {
        id: "session-1",
        signalId: "sig-1",
        status: "ACTIVE"
      }
    });
    const handler = createSignalEnterSessionPostHandler({ enterSession } as any);

    const res = await handler(
      new Request("http://localhost/api/signals/sig-1/enter-session", {
        method: "POST"
      }),
      { params: Promise.resolve({ id: "sig-1" }) }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(enterSession).toHaveBeenCalledWith({ signalId: "sig-1" });
    expect(json.session.id).toBe("session-1");
  });

  it("returns 404 when signal does not exist", async () => {
    const enterSession = vi
      .fn()
      .mockRejectedValue(
        new SignalEnterSessionServiceError("SIGNAL_NOT_FOUND", "signal not found")
      );
    const handler = createSignalEnterSessionPostHandler({ enterSession } as any);

    const res = await handler(
      new Request("http://localhost/api/signals/missing/enter-session", {
        method: "POST"
      }),
      { params: Promise.resolve({ id: "missing" }) }
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("SIGNAL_NOT_FOUND");
  });
});

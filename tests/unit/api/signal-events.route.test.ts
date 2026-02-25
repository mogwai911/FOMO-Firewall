import { describe, expect, it, vi } from "vitest";
import { createSignalEventsPostHandler } from "@/app/api/signals/[id]/events/route";

describe("signal events route", () => {
  it("returns 400 for invalid event type", async () => {
    const recordEvent = vi.fn();
    const handler = createSignalEventsPostHandler({ recordEvent } as any);
    const req = new Request("http://localhost/api/signals/sig-1/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "INVALID" })
    });

    const res = await handler(req, { params: Promise.resolve({ id: "sig-1" }) });

    expect(res.status).toBe(400);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("forwards valid triage-expanded event", async () => {
    const recordEvent = vi.fn().mockResolvedValue({
      id: "evt-1",
      type: "TRIAGE_EXPANDED"
    });
    const handler = createSignalEventsPostHandler({ recordEvent } as any);
    const req = new Request("http://localhost/api/signals/sig-1/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "TRIAGE_EXPANDED",
        payloadJson: {
          source: "digest"
        }
      })
    });

    const res = await handler(req, { params: Promise.resolve({ id: "sig-1" }) });

    expect(res.status).toBe(200);
    expect(recordEvent).toHaveBeenCalledWith({
      type: "TRIAGE_EXPANDED",
      signalId: "sig-1",
      payloadJson: {
        source: "digest"
      }
    });
  });
});

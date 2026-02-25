import { describe, expect, it, vi } from "vitest";
import { createSignalDispositionPostHandler } from "@/app/api/signals/[id]/disposition/route";

describe("signal disposition route", () => {
  it("returns 400 for invalid label", async () => {
    const setDisposition = vi.fn();
    const handler = createSignalDispositionPostHandler({ setDisposition } as any);
    const req = new Request("http://localhost/api/signals/sig-1/disposition", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "INVALID" })
    });

    const res = await handler(req, { params: Promise.resolve({ id: "sig-1" }) });
    expect(res.status).toBe(400);
    expect(setDisposition).not.toHaveBeenCalled();
  });

  it("forwards valid disposition payload", async () => {
    const setDisposition = vi.fn().mockResolvedValue({
      signalId: "sig-1",
      label: "FYI",
      isOverride: true
    });
    const handler = createSignalDispositionPostHandler({ setDisposition } as any);
    const req = new Request("http://localhost/api/signals/sig-1/disposition", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "FYI" })
    });

    const res = await handler(req, { params: Promise.resolve({ id: "sig-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(setDisposition).toHaveBeenCalledWith({
      signalId: "sig-1",
      label: "FYI",
      isOverride: true
    });
    expect(json.disposition.label).toBe("FYI");
  });
});

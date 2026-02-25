import { describe, expect, it, vi } from "vitest";
import { createFyiSignalsGetHandler } from "@/app/api/signals/fyi/route";

describe("fyi route", () => {
  it("returns 400 for invalid limit", async () => {
    const listFyiSignals = vi.fn();
    const handler = createFyiSignalsGetHandler({ listFyiSignals } as any);

    const res = await handler(new Request("http://localhost/api/signals/fyi?limit=0"));

    expect(res.status).toBe(400);
    expect(listFyiSignals).not.toHaveBeenCalled();
  });

  it("returns FYI list", async () => {
    const listFyiSignals = vi.fn().mockResolvedValue([{ id: "sig-1" }]);
    const handler = createFyiSignalsGetHandler({ listFyiSignals } as any);

    const res = await handler(new Request("http://localhost/api/signals/fyi?limit=5"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(listFyiSignals).toHaveBeenCalledWith({ limit: 5 });
    expect(json.signals).toHaveLength(1);
  });
});

import { describe, expect, it, vi } from "vitest";
import { createSignalPreviewGetHandler } from "@/app/api/signals/[id]/preview/route";
import { SignalPreviewServiceError } from "@/lib/services/signal-preview-service";

describe("GET /api/signals/:id/preview", () => {
  it("returns preview payload", async () => {
    const buildPreview = vi.fn().mockResolvedValue({
      signalId: "sig-1",
      title: "title",
      sourceName: "source",
      originalUrl: "https://example.com",
      aiSummary: "summary",
      aiSummaryMode: "LLM",
      articleContent: "content",
      warnings: [],
      generatedAt: "2026-02-22T00:00:00.000Z"
    });
    const handler = createSignalPreviewGetHandler({ buildPreview } as any);

    const res = await handler(new Request("http://localhost/api/signals/sig-1/preview"), {
      params: Promise.resolve({ id: "sig-1" })
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(buildPreview).toHaveBeenCalledWith({ signalId: "sig-1" });
    expect(json.preview.signalId).toBe("sig-1");
  });

  it("returns 404 when signal missing", async () => {
    const buildPreview = vi
      .fn()
      .mockRejectedValue(new SignalPreviewServiceError("SIGNAL_NOT_FOUND", "missing"));
    const handler = createSignalPreviewGetHandler({ buildPreview } as any);

    const res = await handler(new Request("http://localhost/api/signals/missing/preview"), {
      params: Promise.resolve({ id: "missing" })
    });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("SIGNAL_NOT_FOUND");
  });
});

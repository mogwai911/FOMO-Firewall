import { describe, expect, it, vi } from "vitest";
import {
  createSourcesGetHandler,
  createSourcesPostHandler
} from "@/app/api/sources/route";
import {
  createSourceTogglePostHandler
} from "@/app/api/sources/[id]/toggle/route";
import { SourcesServiceError } from "@/lib/services/sources-service";

describe("/api/sources", () => {
  it("creates source with normalized payload", async () => {
    const createSource = vi.fn().mockResolvedValue({
      id: "src-1",
      rssUrl: "https://example.com/rss.xml",
      name: "Example",
      enabled: true,
      tags: ["ai"],
      createdAt: "2026-02-20T00:00:00.000Z",
      updatedAt: "2026-02-20T00:00:00.000Z"
    });

    const handler = createSourcesPostHandler({ createSource } as any);
    const req = new Request("http://localhost/api/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rssUrl: " https://example.com/rss.xml ",
        name: "Example",
        tags: ["ai"]
      })
    });

    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(createSource).toHaveBeenCalledWith({
      rssUrl: "https://example.com/rss.xml",
      name: "Example",
      tags: ["ai"]
    });
    expect(json.source.id).toBe("src-1");
  });

  it("returns 400 for invalid payload", async () => {
    const createSource = vi.fn();
    const handler = createSourcesPostHandler({ createSource } as any);
    const req = new Request("http://localhost/api/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rssUrl: "not-a-url" })
    });

    const res = await handler(req);
    expect(res.status).toBe(400);
    expect(createSource).not.toHaveBeenCalled();
  });

  it("returns 409 for duplicate source", async () => {
    const createSource = vi
      .fn()
      .mockRejectedValue(new SourcesServiceError("DUPLICATE_SOURCE", "source exists"));
    const handler = createSourcesPostHandler({ createSource } as any);
    const req = new Request("http://localhost/api/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rssUrl: "https://example.com/rss.xml"
      })
    });

    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("DUPLICATE_SOURCE");
  });

  it("lists sources", async () => {
    const listSources = vi.fn().mockResolvedValue([
      {
        id: "src-1",
        rssUrl: "https://example.com/rss.xml",
        name: "Example",
        enabled: true,
        tags: [],
        createdAt: "2026-02-20T00:00:00.000Z",
        updatedAt: "2026-02-20T00:00:00.000Z"
      }
    ]);

    const handler = createSourcesGetHandler({ listSources } as any);
    const res = await handler();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sources).toHaveLength(1);
    expect(listSources).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/sources/:id/toggle", () => {
  it("updates enabled flag", async () => {
    const toggleSource = vi.fn().mockResolvedValue({
      id: "src-1",
      rssUrl: "https://example.com/rss.xml",
      name: "Example",
      enabled: false,
      tags: [],
      createdAt: "2026-02-20T00:00:00.000Z",
      updatedAt: "2026-02-20T01:00:00.000Z"
    });

    const handler = createSourceTogglePostHandler({ toggleSource } as any);
    const req = new Request("http://localhost/api/sources/src-1/toggle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false })
    });

    const res = await handler(req, { params: Promise.resolve({ id: "src-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(toggleSource).toHaveBeenCalledWith("src-1", false);
    expect(json.source.enabled).toBe(false);
  });

  it("returns 404 for missing source", async () => {
    const toggleSource = vi
      .fn()
      .mockRejectedValue(new SourcesServiceError("SOURCE_NOT_FOUND", "missing"));
    const handler = createSourceTogglePostHandler({ toggleSource } as any);
    const req = new Request("http://localhost/api/sources/missing/toggle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });

    const res = await handler(req, { params: Promise.resolve({ id: "missing" }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("SOURCE_NOT_FOUND");
  });
});

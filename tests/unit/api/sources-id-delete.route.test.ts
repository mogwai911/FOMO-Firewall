import { describe, expect, it, vi } from "vitest";
import { createSourceDeleteHandler } from "@/app/api/sources/[id]/route";
import { SourcesServiceError } from "@/lib/services/sources-service";

describe("DELETE /api/sources/:id", () => {
  it("deletes source by id", async () => {
    const deleteSource = vi.fn().mockResolvedValue({
      id: "src-1"
    });
    const handler = createSourceDeleteHandler({ deleteSource } as any);

    const res = await handler(
      new Request("http://localhost/api/sources/src-1", {
        method: "DELETE"
      }),
      { params: Promise.resolve({ id: "src-1" }) }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(deleteSource).toHaveBeenCalledWith("src-1");
    expect(json.source.id).toBe("src-1");
  });

  it("returns 404 when source is missing", async () => {
    const deleteSource = vi
      .fn()
      .mockRejectedValue(new SourcesServiceError("SOURCE_NOT_FOUND", "missing"));
    const handler = createSourceDeleteHandler({ deleteSource } as any);

    const res = await handler(
      new Request("http://localhost/api/sources/missing", {
        method: "DELETE"
      }),
      { params: Promise.resolve({ id: "missing" }) }
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("SOURCE_NOT_FOUND");
  });
});

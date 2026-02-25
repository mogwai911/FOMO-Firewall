import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteInsightCard } from "@/lib/client/app-api";

describe("insight card delete api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends DELETE request to insight card endpoint and returns deleted id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          deleted: {
            id: "card-1"
          }
        }),
        {
          status: 200
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const deleted = await deleteInsightCard("card-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/insight_cards/card-1", {
      method: "DELETE"
    });
    expect(deleted.id).toBe("card-1");
  });
});

import { describe, expect, it, vi } from "vitest";
import { createSessionSuggestedQuestionsGetHandler } from "@/app/api/sessions/[id]/suggested-questions/route";
import { SessionSuggestedQuestionsServiceError } from "@/lib/services/session-suggested-questions-service";

describe("GET /api/sessions/:id/suggested-questions", () => {
  it("returns suggested questions payload", async () => {
    const buildSuggestedQuestions = vi.fn().mockResolvedValue({
      questions: ["q1", "q2", "q3"],
      mode: "LLM",
      warnings: []
    });
    const handler = createSessionSuggestedQuestionsGetHandler({
      buildSuggestedQuestions
    } as any);

    const res = await handler(
      new Request("http://localhost/api/sessions/session-1/suggested-questions"),
      {
        params: Promise.resolve({ id: "session-1" })
      }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(buildSuggestedQuestions).toHaveBeenCalledWith({
      sessionId: "session-1"
    });
    expect(json.suggestedQuestions.questions).toHaveLength(3);
  });

  it("returns 404 when session is missing", async () => {
    const buildSuggestedQuestions = vi
      .fn()
      .mockRejectedValue(
        new SessionSuggestedQuestionsServiceError("SESSION_NOT_FOUND", "session not found")
      );
    const handler = createSessionSuggestedQuestionsGetHandler({
      buildSuggestedQuestions
    } as any);

    const res = await handler(
      new Request("http://localhost/api/sessions/missing/suggested-questions"),
      {
        params: Promise.resolve({ id: "missing" })
      }
    );

    expect(res.status).toBe(404);
  });
});

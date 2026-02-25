import {
  generateSessionSuggestedQuestions,
  SessionSuggestedQuestionsServiceError
} from "@/lib/services/session-suggested-questions-service";

interface SessionSuggestedQuestionsRouteContext {
  params:
    | Promise<{
        id: string;
      }>
    | {
        id: string;
      };
}

interface SessionSuggestedQuestionsRouteDeps {
  buildSuggestedQuestions: typeof generateSessionSuggestedQuestions;
}

async function resolveSessionId(context: SessionSuggestedQuestionsRouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export function createSessionSuggestedQuestionsGetHandler(
  deps: SessionSuggestedQuestionsRouteDeps = {
    buildSuggestedQuestions: generateSessionSuggestedQuestions
  }
) {
  return async function GET(
    _request: Request,
    context: SessionSuggestedQuestionsRouteContext
  ): Promise<Response> {
    const sessionId = await resolveSessionId(context);
    try {
      const suggestedQuestions = await deps.buildSuggestedQuestions({
        sessionId
      });
      return Response.json({
        suggestedQuestions
      });
    } catch (error) {
      if (error instanceof SessionSuggestedQuestionsServiceError) {
        const status = error.code === "SESSION_NOT_FOUND" ? 404 : 400;
        return Response.json({ error: error.code, message: error.message }, { status });
      }
      return Response.json({ error: "SESSION_SUGGESTED_QUESTIONS_FAILED" }, { status: 500 });
    }
  };
}

export const GET = createSessionSuggestedQuestionsGetHandler();

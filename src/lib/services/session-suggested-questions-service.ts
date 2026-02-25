import { generateSessionQuestionCards } from "@/lib/agent/session-question-agent";
import { buildChatEndpoint } from "@/lib/llm/openai-chat-stream-client";
import { DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE } from "@/lib/prompts/default-templates";
import { buildSignalPreview } from "@/lib/services/signal-preview-service";
import { getAppSettings, type AppSettingsView } from "@/lib/services/app-settings-service";
import { getSessionDetail, SessionReadServiceError } from "@/lib/services/session-read-service";

interface SessionDetailLike {
  id: string;
  signal: {
    id: string;
    title: string;
    summary: string | null;
    url: string;
    source: {
      name: string | null;
    };
  };
  messages: Array<{
    role: "USER" | "ASSISTANT" | "TOOL";
    content: string;
  }>;
}

interface SessionSuggestedQuestionsDeps {
  getSession: (sessionId: string) => Promise<SessionDetailLike | null>;
  buildPreview: (input: { signalId: string }) => Promise<{
    aiSummary: string;
    articleContent: string | null;
  }>;
  getSettings: () => Promise<AppSettingsView>;
  completeWithLlm: (input: {
    baseUrl: string;
    apiKey: string;
    model: string;
    systemPrompt: string;
    userPrompt: string;
  }) => Promise<string>;
  resolveModel: () => string;
}

export interface SessionSuggestedQuestionsView {
  questions: string[];
  mode: "LLM" | "HEURISTIC";
  warnings: string[];
}

export class SessionSuggestedQuestionsServiceError extends Error {
  code: "SESSION_NOT_FOUND";

  constructor(code: "SESSION_NOT_FOUND", message: string) {
    super(message);
    this.code = code;
  }
}

function normalizeQuestion(value: string): string {
  return value
    .replace(/^[\s>*\-•\d.()]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJsonQuestions(content: string): string[] {
  const raw = content.trim();
  if (!raw) {
    throw new Error("empty llm response");
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1]?.trim() || raw;

  let payload: unknown;
  try {
    payload = JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) {
      throw new Error("invalid llm json payload");
    }
    payload = JSON.parse(candidate.slice(start, end + 1));
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("invalid llm payload");
  }
  const questions = (payload as { questions?: unknown }).questions;
  if (!Array.isArray(questions)) {
    throw new Error("questions field missing");
  }

  const unique = Array.from(
    new Set(
      questions
        .map((item) => (typeof item === "string" ? normalizeQuestion(item) : ""))
        .filter(Boolean)
    )
  );
  return unique.slice(0, 3);
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => vars[key] ?? "");
}

function buildSystemPrompt(input: {
  customPromptTemplate?: string | null;
  signalTitle: string;
  signalSummary: string | null;
  signalSourceName: string | null;
  signalUrl: string;
  signalArticleExcerpt: string | null;
}): string {
  const template =
    input.customPromptTemplate?.trim() || DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE;
  return applyTemplate(template, {
    signalTitle: input.signalTitle,
    signalSummary: input.signalSummary ?? "N/A",
    signalSourceName: input.signalSourceName ?? "N/A",
    signalUrl: input.signalUrl,
    signalArticleExcerpt: input.signalArticleExcerpt ?? ""
  });
}

function buildUserPrompt(input: {
  title: string;
  sourceName: string | null;
  url: string;
  summary: string | null;
  aiSummary: string;
  articleContent: string | null;
}): string {
  return [
    `标题: ${input.title}`,
    `来源: ${input.sourceName ?? "N/A"}`,
    `链接: ${input.url}`,
    `RSS 摘要: ${input.summary ?? "N/A"}`,
    `AI 摘要: ${input.aiSummary || "N/A"}`,
    `原文摘录: ${input.articleContent ?? "N/A"}`
  ].join("\n");
}

function hasLlmConfig(settings: AppSettingsView): boolean {
  return Boolean(settings.apiConfig.baseUrl.trim() && settings.apiConfig.apiKey.trim());
}

function resolveModel(settings: AppSettingsView, deps: Pick<SessionSuggestedQuestionsDeps, "resolveModel">): string {
  const fromSettings = settings.apiConfig.model.trim();
  if (fromSettings) {
    return fromSettings;
  }
  return deps.resolveModel();
}

async function generateWithLlm(
  input: {
    session: SessionDetailLike;
    aiSummary: string;
    articleContent: string | null;
  },
  deps: SessionSuggestedQuestionsDeps
): Promise<string[]> {
  const settings = await deps.getSettings();
  if (!hasLlmConfig(settings)) {
    throw new Error("llm config missing");
  }

  const raw = await deps.completeWithLlm({
    baseUrl: settings.apiConfig.baseUrl.trim(),
    apiKey: settings.apiConfig.apiKey.trim(),
    model: resolveModel(settings, deps),
    systemPrompt: buildSystemPrompt({
      customPromptTemplate: settings.prompts?.suggestedQuestions ?? "",
      signalTitle: input.session.signal.title,
      signalSummary: input.session.signal.summary,
      signalSourceName: input.session.signal.source.name,
      signalUrl: input.session.signal.url,
      signalArticleExcerpt: input.articleContent
    }),
    userPrompt: buildUserPrompt({
      title: input.session.signal.title,
      sourceName: input.session.signal.source.name,
      url: input.session.signal.url,
      summary: input.session.signal.summary,
      aiSummary: input.aiSummary,
      articleContent: input.articleContent
    })
  });

  const parsed = parseJsonQuestions(raw);
  if (parsed.length < 3) {
    throw new Error("insufficient questions");
  }
  return parsed.slice(0, 3);
}

function defaultDeps(): SessionSuggestedQuestionsDeps {
  return {
    getSession: async (sessionId) => {
      try {
        return await getSessionDetail(sessionId);
      } catch (error) {
        if (error instanceof SessionReadServiceError && error.code === "SESSION_NOT_FOUND") {
          return null;
        }
        throw error;
      }
    },
    buildPreview: ({ signalId }) => buildSignalPreview({ signalId }),
    getSettings: () => getAppSettings(),
    completeWithLlm: async (input) => {
      const response = await fetch(buildChatEndpoint(input.baseUrl), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${input.apiKey}`
        },
        body: JSON.stringify({
          model: input.model,
          temperature: 0.6,
          messages: [
            {
              role: "system",
              content: input.systemPrompt
            },
            {
              role: "user",
              content: input.userPrompt
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`llm request failed: ${response.status}`);
      }

      const json = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
          };
        }>;
      };
      const content = json.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error("llm response empty");
      }
      return content;
    },
    resolveModel: () => process.env.TRIAGE_LLM_MODEL ?? "gpt-4o-mini"
  };
}

export async function generateSessionSuggestedQuestions(
  input: {
    sessionId: string;
  },
  deps: SessionSuggestedQuestionsDeps = defaultDeps()
): Promise<SessionSuggestedQuestionsView> {
  const session = await deps.getSession(input.sessionId);
  if (!session) {
    throw new SessionSuggestedQuestionsServiceError("SESSION_NOT_FOUND", "session not found");
  }

  const preview = await deps.buildPreview({
    signalId: session.signal.id
  });
  const warnings: string[] = [];

  try {
    const questions = await generateWithLlm(
      {
        session,
        aiSummary: preview.aiSummary,
        articleContent: preview.articleContent
      },
      deps
    );
    return {
      questions,
      mode: "LLM",
      warnings
    };
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "llm questions failed");
    return {
      questions: generateSessionQuestionCards({
        signal: {
          title: session.signal.title,
          summary: session.signal.summary,
          aiSummary: preview.aiSummary
        },
        messages: session.messages.map((message) => ({
          role: message.role,
          content: message.content
        }))
      }),
      mode: "HEURISTIC",
      warnings
    };
  }
}

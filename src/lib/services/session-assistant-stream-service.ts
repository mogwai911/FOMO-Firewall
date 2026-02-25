import type { AppSettingsView, SessionMessageView } from "@/lib/client/app-types";
import {
  type OpenAIChatStreamMessage,
  type StreamChatCompletionsInput,
  LlmStreamError,
  streamChatCompletions
} from "@/lib/llm/openai-chat-stream-client";
import { buildSessionAssistantPrompt } from "@/lib/prompts/session-assistant";
import { fetchArticleExcerpt } from "@/lib/services/article-excerpt-service";
import { getAppSettings } from "@/lib/services/app-settings-service";
import { getSessionDetail, SessionReadServiceError } from "@/lib/services/session-read-service";
import { appendSessionMessage } from "@/lib/services/session-v2-service";

export class SessionAssistantStreamServiceError extends Error {
  code: "SESSION_NOT_FOUND" | "INVALID_ROLE" | "INVALID_CONTENT";

  constructor(code: "SESSION_NOT_FOUND" | "INVALID_ROLE" | "INVALID_CONTENT", message: string) {
    super(message);
    this.code = code;
  }
}

export type SessionAssistantStreamEvent =
  | {
      type: "ack";
      userMessage: SessionMessageView;
    }
  | {
      type: "delta";
      text: string;
    }
  | {
      type: "done";
      assistantMessage: SessionMessageView;
    }
  | {
      type: "error";
      code: string;
      message: string;
    };

interface SessionAssistantStreamDeps {
  getSession: (sessionId: string) => Promise<SessionContext | null>;
  appendMessage: (input: {
    sessionId: string;
    role: "user" | "assistant";
    content: string;
    metaJson?: unknown;
  }) => Promise<SessionMessageView>;
  getSettings: () => Promise<AppSettingsView>;
  streamChat: (input: StreamChatCompletionsInput) => AsyncGenerator<string>;
  resolveModel: () => string;
  fetchArticleExcerpt: (articleUrl: string) => Promise<string>;
}

interface StreamSessionAssistantReplyInput {
  sessionId: string;
  role: "user";
  content: string;
  metaJson?: unknown;
  signal?: AbortSignal;
}

interface SessionContext {
  signal: {
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

function defaultDeps(): SessionAssistantStreamDeps {
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
    appendMessage: (input) => appendSessionMessage(input),
    getSettings: () => getAppSettings(),
    streamChat: (input) => streamChatCompletions(input),
    resolveModel: () => process.env.TRIAGE_LLM_MODEL ?? "gpt-4o-mini",
    fetchArticleExcerpt: (articleUrl) => fetchArticleExcerpt(articleUrl)
  };
}

function mapStreamError(error: unknown): { code: string; message: string } {
  if (error instanceof LlmStreamError) {
    return {
      code: error.code,
      message: error.message
    };
  }

  if (error instanceof Error && error.name === "AbortError") {
    return {
      code: "LLM_REQUEST_FAILED",
      message: "stream aborted"
    };
  }

  if (error instanceof Error) {
    return {
      code: "SESSION_ASSISTANT_STREAM_FAILED",
      message: error.message
    };
  }

  return {
    code: "SESSION_ASSISTANT_STREAM_FAILED",
    message: "stream failed"
  };
}

function normalizeContent(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new SessionAssistantStreamServiceError("INVALID_CONTENT", "content is required");
  }
  return trimmed;
}

function normalizeMessagesForPrompt(session: SessionContext): Array<{
  role: "USER" | "ASSISTANT" | "TOOL";
  content: string;
}> {
  return session.messages.map((message) => ({
    role: message.role,
    content: message.content
  }));
}

function hasLlmConfig(settings: AppSettingsView): boolean {
  return Boolean(settings.apiConfig.baseUrl.trim() && settings.apiConfig.apiKey.trim());
}

function resolveAssistantModel(
  settings: AppSettingsView,
  deps: Pick<SessionAssistantStreamDeps, "resolveModel">
): string {
  const fromSettings = settings.apiConfig.model?.trim();
  if (fromSettings) {
    return fromSettings;
  }
  return deps.resolveModel();
}

async function resolveArticleExcerpt(
  session: SessionContext,
  deps: Pick<SessionAssistantStreamDeps, "fetchArticleExcerpt">
): Promise<string | null> {
  const articleUrl = session.signal.url.trim();
  if (!articleUrl) {
    return null;
  }
  try {
    return await deps.fetchArticleExcerpt(articleUrl);
  } catch {
    return null;
  }
}

async function buildLlmMessages(
  session: SessionContext,
  userInput: string,
  settings: AppSettingsView,
  deps: Pick<SessionAssistantStreamDeps, "fetchArticleExcerpt">
): Promise<OpenAIChatStreamMessage[]> {
  const articleExcerpt = await resolveArticleExcerpt(session, deps);
  return buildSessionAssistantPrompt({
    signal: {
      title: session.signal.title,
      summary: session.signal.summary,
      url: session.signal.url,
      sourceName: session.signal.source.name,
      articleExcerpt
    },
    history: normalizeMessagesForPrompt(session),
    currentUserMessage: userInput,
    historyLimit: 12,
    customPromptTemplate: settings.prompts?.sessionAssistant ?? ""
  });
}

export async function assertSessionExists(
  sessionId: string,
  deps: Pick<SessionAssistantStreamDeps, "getSession"> = defaultDeps()
): Promise<void> {
  const session = await deps.getSession(sessionId);
  if (!session) {
    throw new SessionAssistantStreamServiceError("SESSION_NOT_FOUND", "session not found");
  }
}

export async function* streamSessionAssistantReply(
  input: StreamSessionAssistantReplyInput,
  deps: SessionAssistantStreamDeps = defaultDeps()
): AsyncGenerator<SessionAssistantStreamEvent> {
  if (input.role !== "user") {
    throw new SessionAssistantStreamServiceError("INVALID_ROLE", "role must be user");
  }

  const userContent = normalizeContent(input.content);
  const session = await deps.getSession(input.sessionId);
  if (!session) {
    throw new SessionAssistantStreamServiceError("SESSION_NOT_FOUND", "session not found");
  }

  const userMessage = await deps.appendMessage({
    sessionId: input.sessionId,
    role: "user",
    content: userContent,
    metaJson: input.metaJson
  });
  yield {
    type: "ack",
    userMessage
  };

  const settings = await deps.getSettings();
  if (!hasLlmConfig(settings)) {
    yield {
      type: "error",
      code: "LLM_CONFIG_MISSING",
      message: "llm base url or api key missing"
    };
    return;
  }

  const promptMessages = await buildLlmMessages(session, userMessage.content, settings, deps);

  let assistantText = "";
  try {
    for await (const delta of deps.streamChat({
      baseUrl: settings.apiConfig.baseUrl,
      apiKey: settings.apiConfig.apiKey,
      model: resolveAssistantModel(settings, deps),
      messages: promptMessages,
      signal: input.signal
    })) {
      if (!delta) {
        continue;
      }
      assistantText += delta;
      yield {
        type: "delta",
        text: delta
      };
    }

    const finalContent = assistantText.trim();
    if (!finalContent) {
      yield {
        type: "error",
        code: "LLM_STREAM_PARSE_FAILED",
        message: "assistant response empty"
      };
      return;
    }

    const assistantMessage = await deps.appendMessage({
      sessionId: input.sessionId,
      role: "assistant",
      content: finalContent
    });

    yield {
      type: "done",
      assistantMessage
    };
  } catch (error) {
    const mapped = mapStreamError(error);
    yield {
      type: "error",
      code: mapped.code,
      message: mapped.message
    };
  }
}

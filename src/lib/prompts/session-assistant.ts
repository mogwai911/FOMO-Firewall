import type { OpenAIChatStreamMessage } from "@/lib/llm/openai-chat-stream-client";
import { DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE } from "@/lib/prompts/default-templates";

interface SessionSignalPromptInput {
  title: string;
  summary: string | null;
  url?: string | null;
  sourceName?: string | null;
  articleExcerpt?: string | null;
}

interface SessionHistoryMessage {
  role: "USER" | "ASSISTANT" | "TOOL";
  content: string;
}

export interface SessionAssistantPromptInput {
  signal: SessionSignalPromptInput;
  history: SessionHistoryMessage[];
  currentUserMessage: string;
  historyLimit?: number;
  customPromptTemplate?: string | null;
}

function normalizeRole(role: SessionHistoryMessage["role"]): "user" | "assistant" {
  if (role === "USER") {
    return "user";
  }
  return "assistant";
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => vars[key] ?? "");
}

function buildSystemPrompt(
  signal: SessionSignalPromptInput,
  customPromptTemplate?: string | null
): string {
  const template = customPromptTemplate?.trim() || DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE;
  return applyTemplate(template, {
    signalTitle: signal.title,
    signalSummary: signal.summary ?? "N/A",
    signalSourceName: signal.sourceName ?? "N/A",
    signalUrl: signal.url ?? "N/A",
    signalArticleExcerpt: signal.articleExcerpt ?? ""
  });
}

export function buildSessionAssistantPrompt(
  input: SessionAssistantPromptInput
): OpenAIChatStreamMessage[] {
  const messages: OpenAIChatStreamMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(input.signal, input.customPromptTemplate)
    }
  ];

  const historyLimit = Math.max(1, Math.min(32, input.historyLimit ?? 12));
  const recentHistory = input.history.slice(-historyLimit);
  for (const message of recentHistory) {
    const content = message.content.trim();
    if (!content) {
      continue;
    }
    messages.push({
      role: normalizeRole(message.role),
      content
    });
  }

  messages.push({
    role: "user",
    content: input.currentUserMessage
  });

  return messages;
}

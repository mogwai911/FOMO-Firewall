import { db } from "@/lib/db";
import { buildChatEndpoint } from "@/lib/llm/openai-chat-stream-client";
import { getAppSettings } from "@/lib/services/app-settings-service";
import { fetchArticleExcerpt } from "@/lib/services/article-excerpt-service";

interface SignalPreviewSignal {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  source: {
    name: string | null;
  };
}

interface SignalPreviewCache {
  signalId: string;
  originalUrl: string;
  aiSummary: string;
  aiSummaryMode: "LLM" | "HEURISTIC";
  articleContent: string | null;
  warningsJson: unknown;
  generatedAt: Date;
}

interface SignalPreviewDeps {
  findSignal: (signalId: string) => Promise<SignalPreviewSignal | null>;
  findPreviewCache: (signalId: string) => Promise<SignalPreviewCache | null>;
  upsertPreviewCache: (input: {
    signalId: string;
    originalUrl: string;
    aiSummary: string;
    aiSummaryMode: "LLM" | "HEURISTIC";
    articleContent: string | null;
    warnings: string[];
    generatedAt: Date;
  }) => Promise<void>;
  fetchArticleExcerpt: (articleUrl: string) => Promise<string>;
  summarizeWithLlm: (input: {
    title: string;
    summary: string | null;
    articleContent: string | null;
    sourceName: string | null;
    url: string;
  }) => Promise<string>;
  hasActiveLlmConfig: () => Promise<boolean>;
  now: () => Date;
}

export class SignalPreviewServiceError extends Error {
  code: "SIGNAL_NOT_FOUND";

  constructor(code: "SIGNAL_NOT_FOUND", message: string) {
    super(message);
    this.code = code;
  }
}

export interface SignalPreviewView {
  signalId: string;
  title: string;
  sourceName: string | null;
  originalUrl: string;
  aiSummary: string;
  aiSummaryMode: "LLM" | "HEURISTIC";
  articleContent: string | null;
  warnings: string[];
  generatedAt: string;
}

export interface SignalPreviewPrefetchSummary {
  requested: number;
  generated: number;
  failed: number;
  errors: Array<{ signalId: string; message: string }>;
}

function isLegacyTruncatedHeuristicCache(cache: SignalPreviewCache): boolean {
  return cache.aiSummaryMode === "HEURISTIC" && cache.aiSummary.trim().endsWith("...");
}

function hasMissingConfigWarning(warnings: string[]): boolean {
  return warnings.some((item) => {
    const normalized = item.trim().toLowerCase();
    return normalized.includes("llm config missing") || normalized.includes("llm_config_missing");
  });
}

function heuristicSummary(input: {
  title: string;
  summary: string | null;
  articleContent: string | null;
}): string {
  const sourceText = input.articleContent ?? input.summary ?? input.title;
  const normalized = sourceText.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return `围绕《${input.title}》建议先阅读原文确认关键结论。`;
  }
  return normalized;
}

function defaultDeps(): SignalPreviewDeps {
  return {
    findSignal: (signalId) =>
      db.signal.findUnique({
        where: {
          id: signalId
        },
        select: {
          id: true,
          title: true,
          url: true,
          summary: true,
          source: {
            select: {
              name: true
            }
          }
        }
      }),
    findPreviewCache: (signalId) =>
      db.signalPreviewCache.findUnique({
        where: {
          signalId
        },
        select: {
          signalId: true,
          originalUrl: true,
          aiSummary: true,
          aiSummaryMode: true,
          articleContent: true,
          warningsJson: true,
          generatedAt: true
        }
      }) as Promise<SignalPreviewCache | null>,
    upsertPreviewCache: async (input) => {
      await db.signalPreviewCache.upsert({
        where: {
          signalId: input.signalId
        },
        create: {
          signalId: input.signalId,
          originalUrl: input.originalUrl,
          aiSummary: input.aiSummary,
          aiSummaryMode: input.aiSummaryMode,
          articleContent: input.articleContent,
          warningsJson: input.warnings,
          generatedAt: input.generatedAt
        },
        update: {
          originalUrl: input.originalUrl,
          aiSummary: input.aiSummary,
          aiSummaryMode: input.aiSummaryMode,
          articleContent: input.articleContent,
          warningsJson: input.warnings,
          generatedAt: input.generatedAt
        }
      });
    },
    fetchArticleExcerpt: (articleUrl) => fetchArticleExcerpt(articleUrl),
    summarizeWithLlm: async (input) => {
      const settings = await getAppSettings();
      const baseUrl = settings.apiConfig.baseUrl.trim();
      const apiKey = settings.apiConfig.apiKey.trim();
      if (!baseUrl || !apiKey) {
        throw new Error("llm config missing");
      }

      const model = settings.apiConfig.model.trim() || process.env.TRIAGE_LLM_MODEL || "gpt-4o-mini";
      const response = await fetch(buildChatEndpoint(baseUrl), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "你是技术信息压缩助手。输出中文，2-4句，先给核心结论，再给一条可执行建议。不要编造。"
            },
            {
              role: "user",
              content: [
                `标题: ${input.title}`,
                `来源: ${input.sourceName ?? "N/A"}`,
                `链接: ${input.url}`,
                `RSS摘要: ${input.summary ?? "N/A"}`,
                `原文内容摘录: ${input.articleContent ?? "N/A"}`
              ].join("\n")
            }
          ]
        })
      });
      if (!response.ok) {
        throw new Error(`llm summary request failed: ${response.status}`);
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
        throw new Error("llm summary empty");
      }
      return content;
    },
    hasActiveLlmConfig: async () => {
      const settings = await getAppSettings();
      return Boolean(settings.apiConfig.baseUrl.trim() && settings.apiConfig.apiKey.trim());
    },
    now: () => new Date()
  };
}

function normalizeWarnings(warningsJson: unknown): string[] {
  if (!Array.isArray(warningsJson)) {
    return [];
  }
  return warningsJson
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

export async function buildSignalPreview(
  input: {
    signalId: string;
    forceRefresh?: boolean;
  },
  deps: SignalPreviewDeps = defaultDeps()
): Promise<SignalPreviewView> {
  const signal = await deps.findSignal(input.signalId);
  if (!signal) {
    throw new SignalPreviewServiceError("SIGNAL_NOT_FOUND", "signal not found");
  }

  const cached = await deps.findPreviewCache(signal.id);
  const cachedWarnings = cached ? normalizeWarnings(cached.warningsJson) : [];
  let hasRecoveredLlmConfig = false;
  if (
    cached &&
    cached.originalUrl === signal.url &&
    cached.aiSummaryMode === "HEURISTIC" &&
    !isLegacyTruncatedHeuristicCache(cached) &&
    hasMissingConfigWarning(cachedWarnings)
  ) {
    try {
      hasRecoveredLlmConfig = await deps.hasActiveLlmConfig();
    } catch {
      hasRecoveredLlmConfig = false;
    }
  }

  const shouldRebuildForRecoveredLlmConfig =
    cached &&
    cached.originalUrl === signal.url &&
    cached.aiSummaryMode === "HEURISTIC" &&
    !isLegacyTruncatedHeuristicCache(cached) &&
    hasMissingConfigWarning(cachedWarnings) &&
    hasRecoveredLlmConfig;

  if (
    cached &&
    cached.originalUrl === signal.url &&
    !input.forceRefresh &&
    !isLegacyTruncatedHeuristicCache(cached) &&
    !shouldRebuildForRecoveredLlmConfig
  ) {
    return {
      signalId: signal.id,
      title: signal.title,
      sourceName: signal.source.name,
      originalUrl: cached.originalUrl,
      aiSummary: cached.aiSummary,
      aiSummaryMode: cached.aiSummaryMode,
      articleContent: cached.articleContent,
      warnings: cachedWarnings,
      generatedAt: cached.generatedAt.toISOString()
    };
  }

  const warnings: string[] = [];
  let articleContent: string | null = null;
  try {
    articleContent = await deps.fetchArticleExcerpt(signal.url);
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "article fetch failed");
  }

  let aiSummaryMode: "LLM" | "HEURISTIC" = "LLM";
  let aiSummary = "";
  try {
    aiSummary = await deps.summarizeWithLlm({
      title: signal.title,
      summary: signal.summary,
      articleContent,
      sourceName: signal.source.name,
      url: signal.url
    });
  } catch (error) {
    aiSummaryMode = "HEURISTIC";
    warnings.push(error instanceof Error ? error.message : "llm summary failed");
    aiSummary = heuristicSummary({
      title: signal.title,
      summary: signal.summary,
      articleContent
    });
  }

  const generatedAt = deps.now();
  await deps.upsertPreviewCache({
    signalId: signal.id,
    originalUrl: signal.url,
    aiSummary,
    aiSummaryMode,
    articleContent,
    warnings,
    generatedAt
  });

  return {
    signalId: signal.id,
    title: signal.title,
    sourceName: signal.source.name,
    originalUrl: signal.url,
    aiSummary,
    aiSummaryMode,
    articleContent,
    warnings,
    generatedAt: generatedAt.toISOString()
  };
}

export async function prefetchSignalPreview(
  input: { signalIds: string[]; forceRefresh?: boolean },
  deps: SignalPreviewDeps = defaultDeps()
): Promise<SignalPreviewPrefetchSummary> {
  const uniqueSignalIds = Array.from(new Set(input.signalIds));
  const errors: Array<{ signalId: string; message: string }> = [];
  let generated = 0;

  for (const signalId of uniqueSignalIds) {
    try {
      await buildSignalPreview(
        {
          signalId,
          forceRefresh: input.forceRefresh
        },
        deps
      );
      generated += 1;
    } catch (error) {
      errors.push({
        signalId,
        message: error instanceof Error ? error.message : "signal preview prefetch failed"
      });
    }
  }

  return {
    requested: uniqueSignalIds.length,
    generated,
    failed: errors.length,
    errors
  };
}

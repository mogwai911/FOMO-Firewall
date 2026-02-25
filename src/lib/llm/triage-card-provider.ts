import {
  generateHeuristicTriageCard,
  type RoleV2,
  type TriageCardV2
} from "@/lib/agent/triage-agent";
import { buildTriagePrompt } from "@/lib/prompts/triage";

export interface TriageCardProviderInput {
  role: RoleV2;
  title: string;
  summary: string | null;
  sourceName: string | null;
  promptTemplate?: string;
}

export interface TriageCardProvider {
  generate: (input: TriageCardProviderInput) => Promise<TriageCardV2>;
}

interface RemoteProviderOptions {
  url: string;
  apiKey: string;
}

interface OpenAICompatibleProviderOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface TriageProviderRuntimeConfig {
  mode?: string;
  url?: string;
  apiKey?: string;
  model?: string;
}

type LegacyEnvShape = Record<string, string | undefined>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function expectedNextActionHint(label: TriageCardV2["label"]): TriageCardV2["next_action_hint"] {
  if (label === "DO") return "ENTER_SESSION";
  if (label === "FYI") return "BOOKMARK";
  return "DISMISS";
}

function normalizeReasonText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : "该条目信息不足，建议补充原文后再判断。";
}

function parseReasons(value: unknown): TriageCardV2["reasons"] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (!isObject(item)) {
        return null;
      }
      const type = item.type;
      const text = item.text;
      const confidence = item.confidence;
      if (
        (type !== "source" &&
          type !== "verifiability" &&
          type !== "novelty" &&
          type !== "relevance" &&
          type !== "risk") ||
        typeof text !== "string" ||
        typeof confidence !== "number" ||
        Number.isNaN(confidence)
      ) {
        return null;
      }
      const reasonType = type as TriageCardV2["reasons"][number]["type"];
      return {
        type: reasonType,
        text: normalizeReasonText(text),
        confidence: Math.max(0, Math.min(1, confidence))
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 3);
}

function parseSnippets(value: unknown): TriageCardV2["snippets"] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (!isObject(item)) {
        return null;
      }
      const text = item.text;
      const source = item.source;
      if (
        typeof text !== "string" ||
        (source !== "rss_summary" && source !== "fetched_excerpt")
      ) {
        return null;
      }
      const snippetSource = source as TriageCardV2["snippets"][number]["source"];
      return {
        text: text.trim(),
        source: snippetSource
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 2);
}

function validateTriagePayload(payload: unknown): TriageCardV2 {
  if (!isObject(payload)) {
    throw new Error("invalid triage payload");
  }

  const label = payload.label;
  const headline = payload.headline;
  const reasons = payload.reasons;
  const snippets = payload.snippets;
  const nextActionHint = payload.next_action_hint;
  const score = payload.score;

  if (label !== "FYI" && label !== "DO" && label !== "DROP") {
    throw new Error("invalid triage payload");
  }
  if (typeof headline !== "string" || headline.trim().length === 0) {
    throw new Error("invalid triage payload");
  }
  if (!Array.isArray(reasons) || !Array.isArray(snippets)) {
    throw new Error("invalid triage payload");
  }
  if (typeof score !== "number" || Number.isNaN(score)) {
    throw new Error("invalid triage payload");
  }

  const expectedHint = expectedNextActionHint(label);
  const mappedNextActionHint =
    nextActionHint === "ENTER_SESSION" || nextActionHint === "BOOKMARK" || nextActionHint === "DISMISS"
      ? nextActionHint === expectedHint
        ? nextActionHint
        : expectedHint
      : expectedHint;

  const parsedReasons = parseReasons(reasons);
  const parsedSnippets = parseSnippets(snippets);
  if (parsedReasons.length === 0) {
    throw new Error("invalid triage payload");
  }

  return {
    label,
    headline,
    reasons: parsedReasons,
    snippets: parsedSnippets,
    next_action_hint: mappedNextActionHint,
    score: Math.max(0, Math.min(100, Math.round(score)))
  };
}

export function createRemoteTriageCardProvider(
  options: RemoteProviderOptions,
  fetchImpl: typeof fetch = fetch
): TriageCardProvider {
  return {
    async generate(input) {
      const response = await fetchImpl(options.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {})
        },
        body: JSON.stringify({
          role: input.role,
          title: input.title,
          summary: input.summary,
          sourceName: input.sourceName
        })
      });
      if (!response.ok) {
        throw new Error(`remote triage request failed: ${response.status}`);
      }
      const payload = (await response.json()) as unknown;
      return validateTriagePayload(payload);
    }
  };
}

function buildOpenAICompletionsEndpoint(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }
  return `${normalized}/chat/completions`;
}

function combineExtractedText(input: TriageCardProviderInput): string {
  const chunks = [
    `title: ${input.title}`,
    `summary: ${input.summary ?? "N/A"}`,
    `source: ${input.sourceName ?? "N/A"}`
  ];
  return chunks.join("\n");
}

function normalizeStructuredPayload(payload: unknown): unknown {
  if (!isObject(payload)) {
    return payload;
  }

  const mapped: Record<string, unknown> = { ...payload };
  if (mapped.nextActionHint !== undefined && mapped.next_action_hint === undefined) {
    mapped.next_action_hint = mapped.nextActionHint;
  }
  return mapped;
}

function parseModelJsonContent(content: string): unknown {
  const raw = content.trim();
  if (!raw) {
    throw new Error("invalid triage payload");
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1]?.trim() || raw;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const sliced = candidate.slice(start, end + 1);
      try {
        return JSON.parse(sliced);
      } catch {
        throw new Error("invalid triage payload");
      }
    }
    throw new Error("invalid triage payload");
  }
}

export function createOpenAICompatibleTriageCardProvider(
  options: OpenAICompatibleProviderOptions,
  fetchImpl: typeof fetch = fetch
): TriageCardProvider {
  const endpoint = buildOpenAICompletionsEndpoint(options.baseUrl);

  return {
    async generate(input) {
      const systemInstruction = [
        "你是Feed分流助手，只输出JSON。",
        "JSON keys必须是: label, headline, reasons, snippets, next_action_hint, score。",
        "label 只能是 FYI/DO/DROP。",
        "headline 必须说明“这条feed能提供什么价值”，并且给出“建议：去学习/稍后看/忽略”之一。",
        "reasons 必须具体，不要空泛。",
        "next_action_hint 必须遵守映射：FYI->BOOKMARK, DO->ENTER_SESSION, DROP->DISMISS。"
      ].join(" ");
      const triagePrompt = buildTriagePrompt({
        role: input.role,
        title: input.title,
        summary: input.summary,
        sourceName: input.sourceName,
        url: null,
        extractedText: combineExtractedText(input),
        customPromptTemplate: input.promptTemplate
      });

      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {})
        },
        body: JSON.stringify({
          model: options.model,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: systemInstruction
            },
            {
              role: "user",
              content: triagePrompt
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`openai-compatible triage request failed: ${response.status}`);
      }

      const json = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
          };
        }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.trim().length === 0) {
        throw new Error("invalid triage payload");
      }

      const parsed = parseModelJsonContent(content);

      return validateTriagePayload(normalizeStructuredPayload(parsed));
    }
  };
}

function readMode(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function isLegacyEnvShape(value: unknown): value is LegacyEnvShape {
  return (
    isObject(value) &&
    ("TRIAGE_PROVIDER" in value || "TRIAGE_LLM_URL" in value || "TRIAGE_LLM_API_KEY" in value)
  );
}

function normalizeResolverConfig(
  input: TriageProviderRuntimeConfig | LegacyEnvShape | undefined,
  env: Record<string, string | undefined>
): Required<TriageProviderRuntimeConfig> {
  if (isLegacyEnvShape(input)) {
    return {
      mode: input.TRIAGE_PROVIDER ?? env.TRIAGE_PROVIDER ?? "",
      url: input.TRIAGE_LLM_URL ?? env.TRIAGE_LLM_URL ?? "",
      apiKey: input.TRIAGE_LLM_API_KEY ?? env.TRIAGE_LLM_API_KEY ?? "",
      model: input.TRIAGE_LLM_MODEL ?? env.TRIAGE_LLM_MODEL ?? "gpt-4o-mini"
    };
  }

  const runtime = input ?? {};
  return {
    mode: runtime.mode ?? env.TRIAGE_PROVIDER ?? "",
    url: runtime.url ?? env.TRIAGE_LLM_URL ?? "",
    apiKey: runtime.apiKey ?? env.TRIAGE_LLM_API_KEY ?? "",
    model: runtime.model ?? env.TRIAGE_LLM_MODEL ?? "gpt-4o-mini"
  };
}

export function resolveTriageCardProvider(
  input?: TriageProviderRuntimeConfig | LegacyEnvShape,
  fetchImpl: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env
): TriageCardProvider {
  const config = normalizeResolverConfig(input, env);
  const mode = readMode(config.mode);
  const url = config.url.trim();

  if (url) {
    const forceCustom = mode === "remote_custom";
    const looksCustom = /\/triage\/?$/i.test(url);

    if (forceCustom || looksCustom) {
      return createRemoteTriageCardProvider(
        {
          url,
          apiKey: config.apiKey
        },
        fetchImpl
      );
    }

    if (mode === "" || mode === "remote" || mode === "openai") {
      return createOpenAICompatibleTriageCardProvider(
        {
          baseUrl: url,
          apiKey: config.apiKey,
          model: config.model || "gpt-4o-mini"
        },
        fetchImpl
      );
    }
  }

  return {
    async generate(input) {
      return generateHeuristicTriageCard(
        {
          title: input.title,
          summary: input.summary,
          sourceName: input.sourceName
        },
        input.role
      );
    }
  };
}

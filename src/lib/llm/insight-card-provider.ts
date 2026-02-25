import { buildInsightCard, type DepositMessage, type InsightCardDraft } from "@/lib/agent/deposit-agent";
import { buildChatEndpoint } from "@/lib/llm/openai-chat-stream-client";
import { getAppSettings, type AppSettingsView } from "@/lib/services/app-settings-service";

interface InsightCardProviderInput {
  signalTitle: string;
  signalSummary: string | null;
  messages: DepositMessage[];
}

interface InsightCardProviderDeps {
  getSettings: () => Promise<AppSettingsView>;
  completeWithLlm: (input: {
    baseUrl: string;
    apiKey: string;
    model: string;
    systemPrompt: string;
    userPrompt: string;
  }) => Promise<string>;
}

function compactText(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function parseJsonPayload(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;
  return JSON.parse(candidate);
}

function normalizeStringArray(value: unknown, min: number, max: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = value
    .map((item) => (typeof item === "string" ? compactText(item) : ""))
    .filter(Boolean);
  const unique = Array.from(new Set(normalized));
  return unique.slice(0, Math.max(min, max));
}

function normalizeInsightCardFromLlm(
  input: InsightCardProviderInput,
  payload: unknown
): InsightCardDraft | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const row = payload as {
    abstract?: unknown;
    key_points?: unknown;
    evidence?: unknown;
    limitations?: unknown;
  };

  const abstract = typeof row.abstract === "string" ? compactText(row.abstract) : "";
  const keyPoints = normalizeStringArray(row.key_points, 3, 5);
  const limitations = normalizeStringArray(row.limitations, 1, 3);
  const evidence = Array.isArray(row.evidence)
    ? row.evidence
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const evidenceRow = item as { text?: unknown; from?: unknown };
          if (typeof evidenceRow.text !== "string") return null;
          const text = compactText(evidenceRow.text);
          if (!text) return null;
          return {
            text,
            from: evidenceRow.from === "rss_summary" ? "rss_summary" : "conversation"
          } as InsightCardDraft["evidence"][number];
        })
        .filter((item): item is InsightCardDraft["evidence"][number] => item !== null)
        .slice(0, 4)
    : [];

  if (!abstract || keyPoints.length < 3 || evidence.length < 1 || limitations.length < 1) {
    return null;
  }

  return {
    version: 2,
    signal_title: input.signalTitle,
    abstract,
    key_points: keyPoints,
    evidence,
    limitations
  };
}

function buildSystemPrompt(): string {
  return [
    "你是洞察压缩助手。输出必须是严格 JSON，且只包含字段：abstract,key_points,evidence,limitations。",
    "目标是论文摘要风格：先给价值摘要，再给可复核论点和证据，最后给局限。",
    "禁止输出动作建议、下一步计划、营销语、模板套话。"
  ].join("\n");
}

function buildUserPrompt(input: InsightCardProviderInput): string {
  const tailMessages = input.messages
    .slice(-8)
    .map((message) => `${message.role}: ${compactText(message.content)}`)
    .join("\n");
  return [
    `信号标题: ${input.signalTitle}`,
    `信号摘要: ${input.signalSummary ?? "N/A"}`,
    "会话片段:",
    tailMessages || "N/A",
    "输出格式示例:",
    '{"abstract":"...","key_points":["..."],"evidence":[{"text":"...","from":"conversation"}],"limitations":["..."]}'
  ].join("\n");
}

function defaultDeps(): InsightCardProviderDeps {
  return {
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
          temperature: 0.2,
          messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user", content: input.userPrompt }
          ]
        })
      });
      if (!response.ok) {
        throw new Error(`insight llm request failed: ${response.status}`);
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
        throw new Error("insight llm response empty");
      }
      return content;
    }
  };
}

export async function createInsightCardWithProvider(
  input: InsightCardProviderInput,
  deps: InsightCardProviderDeps = defaultDeps()
): Promise<InsightCardDraft> {
  try {
    const settings = await deps.getSettings();
    const baseUrl = settings.apiConfig.baseUrl.trim();
    const apiKey = settings.apiConfig.apiKey.trim();
    const model = settings.apiConfig.model.trim() || process.env.TRIAGE_LLM_MODEL || "gpt-4o-mini";

    if (!baseUrl || !apiKey) {
      throw new Error("llm config missing");
    }

    const raw = await deps.completeWithLlm({
      baseUrl,
      apiKey,
      model,
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt(input)
    });

    const parsed = normalizeInsightCardFromLlm(input, parseJsonPayload(raw));
    if (!parsed) {
      throw new Error("insight llm payload invalid");
    }
    return parsed;
  } catch {
    return buildInsightCard({
      signalTitle: input.signalTitle,
      messages: input.messages
    });
  }
}

type LlmMode = "LLM" | "HEURISTIC";

interface LlmWarningInput {
  mode?: LlmMode;
  warnings?: string[];
}

interface SessionStreamErrorInput {
  code?: string | null;
  message?: string | null;
}

const MISSING_CONFIG_HINT =
  "未配置 LLM API Key。请前往“设置 > LLM 接入”填写 Base URL 和 API Key。";
const LLM_FALLBACK_HINT = "LLM 当前不可用，已切换为降级结果。请检查 LLM 接入配置。";

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function hasMissingConfigMessage(messages: string[]): boolean {
  return messages.some((item) => {
    const normalized = normalizeText(item);
    return normalized.includes("llm config missing") || normalized.includes("llm_config_missing");
  });
}

export function formatLlmWarningHint(input: LlmWarningInput): string | null {
  const warnings = (input.warnings ?? []).filter((item) => item.trim().length > 0);
  if (warnings.length === 0) {
    return null;
  }
  if (hasMissingConfigMessage(warnings)) {
    return MISSING_CONFIG_HINT;
  }
  if (input.mode === "HEURISTIC") {
    return LLM_FALLBACK_HINT;
  }
  return null;
}

export function formatSessionStreamErrorHint(input: SessionStreamErrorInput): string | null {
  const code = input.code?.trim().toUpperCase() ?? "";
  const message = input.message?.trim() ?? "";
  if (code === "LLM_CONFIG_MISSING") {
    return MISSING_CONFIG_HINT;
  }
  if (message && hasMissingConfigMessage([message])) {
    return MISSING_CONFIG_HINT;
  }
  return null;
}

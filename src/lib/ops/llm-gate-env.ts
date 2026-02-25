type LlmE2EEnvInput = Partial<
  Record<"LLM_E2E_BASE_URL" | "LLM_E2E_API_KEY", string | undefined>
>;

interface LlmE2EEnvValue {
  baseUrl: string;
  apiKey: string;
}

type LlmE2EEnvResult =
  | {
      ok: true;
      value: LlmE2EEnvValue;
    }
  | {
      ok: false;
      missing: Array<"LLM_E2E_BASE_URL" | "LLM_E2E_API_KEY">;
    };

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function resolveLlmE2EEnv(env: LlmE2EEnvInput): LlmE2EEnvResult {
  const baseUrl = env.LLM_E2E_BASE_URL?.trim() ?? "";
  const apiKey = env.LLM_E2E_API_KEY?.trim() ?? "";
  const missing: Array<"LLM_E2E_BASE_URL" | "LLM_E2E_API_KEY"> = [];

  if (!baseUrl || !isHttpUrl(baseUrl)) {
    missing.push("LLM_E2E_BASE_URL");
  }
  if (!apiKey) {
    missing.push("LLM_E2E_API_KEY");
  }

  if (missing.length > 0) {
    return {
      ok: false,
      missing
    };
  }

  return {
    ok: true,
    value: {
      baseUrl,
      apiKey
    }
  };
}

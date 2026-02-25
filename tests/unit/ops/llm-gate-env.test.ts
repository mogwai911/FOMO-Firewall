import { describe, expect, it } from "vitest";
import { resolveLlmE2EEnv } from "@/lib/ops/llm-gate-env";

describe("resolveLlmE2EEnv", () => {
  it("returns missing variable names when env is incomplete", () => {
    const result = resolveLlmE2EEnv({
      LLM_E2E_BASE_URL: "",
      LLM_E2E_API_KEY: ""
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected missing env result");
    }
    expect(result.missing).toEqual(["LLM_E2E_BASE_URL", "LLM_E2E_API_KEY"]);
  });

  it("rejects non-http base url", () => {
    const result = resolveLlmE2EEnv({
      LLM_E2E_BASE_URL: "not-a-url",
      LLM_E2E_API_KEY: "abc"
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected invalid env result");
    }
    expect(result.missing).toEqual(["LLM_E2E_BASE_URL"]);
  });

  it("returns normalized values when env is valid", () => {
    const result = resolveLlmE2EEnv({
      LLM_E2E_BASE_URL: " https://api.openai.com/v1 ",
      LLM_E2E_API_KEY: " sk-test "
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected valid env result");
    }
    expect(result.value.baseUrl).toBe("https://api.openai.com/v1");
    expect(result.value.apiKey).toBe("sk-test");
  });
});

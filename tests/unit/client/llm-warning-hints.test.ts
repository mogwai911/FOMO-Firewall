import { describe, expect, it } from "vitest";
import {
  formatLlmWarningHint,
  formatSessionStreamErrorHint
} from "@/lib/client/llm-warning-hints";

describe("llm-warning-hints", () => {
  it("returns config guidance when warnings indicate missing llm config", () => {
    const hint = formatLlmWarningHint({
      mode: "HEURISTIC",
      warnings: ["llm config missing"]
    });
    expect(hint).toContain("未配置 LLM API Key");
    expect(hint).toContain("设置");
  });

  it("returns null for llm mode with no warnings", () => {
    const hint = formatLlmWarningHint({
      mode: "LLM",
      warnings: []
    });
    expect(hint).toBeNull();
  });

  it("maps session stream config error to guidance text", () => {
    const hint = formatSessionStreamErrorHint({
      code: "LLM_CONFIG_MISSING",
      message: "llm config missing"
    });
    expect(hint).toContain("未配置 LLM API Key");
  });
});

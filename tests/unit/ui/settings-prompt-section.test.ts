import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE,
  DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE,
  DEFAULT_TRIAGE_PROMPT_TEMPLATE
} from "@/lib/prompts/default-templates";

describe("settings prompt section", () => {
  it("contains editable prompt fields for triage and session assistant", () => {
    const pagePath = resolve(process.cwd(), "src/app/app/settings/page.tsx");
    const source = readFileSync(pagePath, "utf-8");

    expect(source).toContain('label: "提示词"');
    expect(source).toContain("分流提示词");
    expect(source).toContain("学习助手提示词");
    expect(source).toContain("提问提示词");
    expect(source).toContain("保存提示词");
    expect(source).toContain("LLM 模型");
    expect(source).toContain("显示 API Key");
    expect(source).toContain("已保存 API Key");
  });

  it("uses shared default prompt presets instead of empty strings", () => {
    const pagePath = resolve(process.cwd(), "src/app/app/settings/page.tsx");
    const source = readFileSync(pagePath, "utf-8");

    expect(DEFAULT_TRIAGE_PROMPT_TEMPLATE.length).toBeGreaterThan(20);
    expect(DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE.length).toBeGreaterThan(20);
    expect(DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE.length).toBeGreaterThan(20);
    expect(DEFAULT_LLM_MODEL).toBe("gpt-4o-mini");
    expect(source).toContain("DEFAULT_TRIAGE_PROMPT_TEMPLATE");
    expect(source).toContain("DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE");
    expect(source).toContain("DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE");
    expect(source).toContain("DEFAULT_LLM_MODEL");
  });
});

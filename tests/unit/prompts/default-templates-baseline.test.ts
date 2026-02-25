import { describe, expect, it } from "vitest";
import {
  DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE,
  DEFAULT_TRIAGE_PROMPT_TEMPLATE
} from "@/lib/prompts/default-templates";

describe("default prompt templates baseline", () => {
  it("uses the approved triage baseline prompt", () => {
    expect(DEFAULT_TRIAGE_PROMPT_TEMPLATE).toContain("用户深受信息过载困扰");
    expect(DEFAULT_TRIAGE_PROMPT_TEMPLATE).toContain("你的唯一职责是：替用户判断这条 feed 是否值得花时间");
    expect(DEFAULT_TRIAGE_PROMPT_TEMPLATE).toContain("headline：中文一句话，直接给出价值判断");
  });

  it("uses the approved session assistant baseline prompt", () => {
    expect(DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE).toContain("用户正在消化 feed 内容");
    expect(DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE).toContain("认知可迁移");
    expect(DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE).toContain("形式服从内容");
  });
});

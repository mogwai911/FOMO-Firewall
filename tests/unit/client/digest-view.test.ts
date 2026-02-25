import { describe, expect, it } from "vitest";
import {
  buildDigestResetConfirmMessage,
  formatDigestPublishedAt,
  formatSuggestionLabel
} from "@/lib/client/digest-view";

describe("digest-view helpers", () => {
  it("formats publishedAt to hour-level readable text", () => {
    expect(formatDigestPublishedAt("2026-02-22T02:43:00.000Z")).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:00$/
    );
  });

  it("maps FYI to low-burden wording", () => {
    expect(formatSuggestionLabel("FYI")).toBe("稍后看");
    expect(formatSuggestionLabel("DO")).toBe("去学习");
    expect(formatSuggestionLabel("DROP")).toBe("忽略");
  });

  it("builds clear multi-line reset confirm message", () => {
    const message = buildDigestResetConfirmMessage();
    expect(message).toContain("\n");
    expect(message).toContain("重新标记为“待处理”");
    expect(message).not.toContain("\\n");
  });
});

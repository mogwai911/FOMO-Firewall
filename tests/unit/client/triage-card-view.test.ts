import { describe, expect, it } from "vitest";
import { parseTriageCardView } from "@/lib/client/triage-card-view";

describe("triage-card-view parser", () => {
  it("parses valid triage payload and clamps list lengths", () => {
    const parsed = parseTriageCardView({
      label: "DO",
      headline: "建议 DO：可执行价值高",
      reasons: [
        { type: "relevance", text: "与目标强相关", confidence: 0.81 },
        { type: "source", text: "来源可信", confidence: 0.72 },
        { type: "verifiability", text: "可快速验证", confidence: 0.69 },
        { type: "risk", text: "不应出现", confidence: 0.1 }
      ],
      snippets: [
        { text: "片段1", source: "rss_summary" },
        { text: "片段2", source: "fetched_excerpt" },
        { text: "片段3", source: "rss_summary" }
      ],
      next_action_hint: "ENTER_SESSION",
      score: 88
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.label).toBe("DO");
    expect(parsed?.headline).toContain("建议 DO");
    expect(parsed?.reasons).toHaveLength(3);
    expect(parsed?.snippets).toHaveLength(2);
    expect(parsed?.nextActionHint).toBe("ENTER_SESSION");
    expect(parsed?.score).toBe(88);
  });

  it("returns null for invalid payload", () => {
    expect(parseTriageCardView(null)).toBeNull();
    expect(parseTriageCardView({})).toBeNull();
    expect(
      parseTriageCardView({
        label: "INVALID",
        headline: "x",
        reasons: [],
        snippets: [],
        next_action_hint: "ENTER_SESSION",
        score: 0
      })
    ).toBeNull();
  });

  it("sanitizes FYI wording in user-visible triage copy", () => {
    const parsed = parseTriageCardView({
      label: "FYI",
      headline: "建议 FYI：信息有参考价值",
      reasons: [{ type: "relevance", text: "可以先 FYI 观察", confidence: 0.7 }],
      snippets: [{ text: "FYI: 首发信息", source: "rss_summary" }],
      next_action_hint: "BOOKMARK",
      score: 50
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.headline).not.toContain("FYI");
    expect(parsed?.reasons[0]?.text).not.toContain("FYI");
    expect(parsed?.snippets[0]?.text).not.toContain("FYI");
  });
});

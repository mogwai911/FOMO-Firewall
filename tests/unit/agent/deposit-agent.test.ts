import { describe, expect, it } from "vitest";
import {
  buildEvidencePack,
  buildInsightCard
} from "@/lib/agent/deposit-agent";

const SAMPLE_MESSAGES = [
  { role: "USER" as const, content: "这条线索要怎么验证？" },
  { role: "ASSISTANT" as const, content: "先做最小验证并记录结果。" }
];

describe("deposit-agent", () => {
  it("generates one paper-style insight card in v2 contract", () => {
    const card = buildInsightCard({
      signalTitle: "OpenAI update",
      messages: SAMPLE_MESSAGES
    });

    expect(card.version).toBe(2);
    expect(card.signal_title).toContain("OpenAI update");
    expect(card.abstract.length).toBeGreaterThan(0);
    expect(card.key_points.length).toBeGreaterThanOrEqual(3);
    expect(card.key_points.length).toBeLessThanOrEqual(5);
    expect(card.evidence.length).toBeGreaterThanOrEqual(1);
    expect(card.evidence.length).toBeLessThanOrEqual(4);
    expect(card.limitations.length).toBeGreaterThanOrEqual(1);
    expect(card.limitations.length).toBeLessThanOrEqual(3);
    expect(card).not.toHaveProperty("decision");
    expect(card).not.toHaveProperty("next_action");
    expect(card).not.toHaveProperty("risk_boundary");
  });

  it("builds evidence pack with trace", () => {
    const pack = buildEvidencePack({
      signalSummary: "更新说明",
      messages: SAMPLE_MESSAGES,
      signalId: "sig-1",
      sessionId: "session-1"
    });

    expect(pack.summary.length).toBeGreaterThan(0);
    expect(pack.trace.signal_id).toBe("sig-1");
    expect(pack.trace.session_id).toBe("session-1");
  });
});

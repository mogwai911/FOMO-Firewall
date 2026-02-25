import { describe, expect, it, vi } from "vitest";
import { buildTriageCard, generateTriageForSignal } from "@/lib/services/triage-v2-service";

describe("triage-v2-service", () => {
  it("builds bounded triage card fields", () => {
    const card = buildTriageCard(
      {
        title: "OpenAI 发布 migration guide",
        summary: "包含 breaking changes 与迁移步骤。",
        sourceName: "OpenAI Blog"
      },
      "ENG"
    );

    expect(["FYI", "DO", "DROP"]).toContain(card.label);
    expect(card.headline.length).toBeGreaterThan(0);
    expect(card.reasons.length).toBeGreaterThan(0);
    expect(card.reasons.length).toBeLessThanOrEqual(3);
    expect(card.snippets.length).toBeLessThanOrEqual(2);
    expect(card.score).toBeGreaterThanOrEqual(0);
    expect(card.score).toBeLessThanOrEqual(100);
  });

  it("classifies obvious rumor content as DROP", () => {
    const card = buildTriageCard(
      {
        title: "Rumor: mysterious model leak",
        summary: "纯猜测与转发，暂无官方证据。",
        sourceName: "Unknown"
      },
      "PM"
    );

    expect(card.label).toBe("DROP");
    expect(card.next_action_hint).toBe("DISMISS");
  });

  it("falls back to heuristic triage when remote provider fails", async () => {
    const createTriage = vi.fn().mockResolvedValue({
      id: "tri-1",
      triageJson: {}
    });

    const out = await generateTriageForSignal(
      {
        signalId: "sig-1",
        role: "ENG"
      },
      {
        findSignal: vi.fn().mockResolvedValue({
          id: "sig-1",
          title: "CVPR 2026放榜",
          summary: "录用率公布，审稿意见即将发布",
          source: {
            name: "机器之心"
          }
        }),
        generateCard: vi.fn().mockRejectedValue(new Error("remote triage request failed: 500")),
        createTriage
      }
    );

    expect(out.triageId).toBe("tri-1");
    expect(["FYI", "DO", "DROP"]).toContain(out.triage.label);
    expect(out.triage.headline.length).toBeGreaterThan(0);
    expect(createTriage).toHaveBeenCalledTimes(1);
  });
});

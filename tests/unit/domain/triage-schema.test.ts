import { describe, expect, it } from "vitest";
import { triageSchema } from "@/lib/domain/triage-schema";

const basePayload = {
  role_fit: {
    pm: "Affects roadmap planning",
    eng: "Impacts implementation choices",
    res: "Changes experiment priority"
  },
  time_sensitivity: {
    label: "LATER",
    miss_cost: "MEDIUM"
  },
  scores: {
    actionability: 70,
    hype_noise: 30
  },
  recommended_action: "SCHEDULE",
  one_step_task: {
    task: "Build a tiny POC",
    done_definition: "POC runs with one sample input",
    estimated_minutes: 25
  },
  reasons: ["Role relevance", "Time sensitivity", "Actionability evidence"],
  policy_trace: {
    final_label: "LATER",
    rule_id: "R3",
    consistency: "PASS"
  }
};

describe("triage schema", () => {
  it("rejects more than 3 reasons", () => {
    const parsed = triageSchema.safeParse({
      ...basePayload,
      reasons: ["a", "b", "c", "d"]
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects score outside 0..100", () => {
    const parsed = triageSchema.safeParse({
      ...basePayload,
      scores: {
        actionability: 101,
        hype_noise: 10
      }
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects invalid miss_cost enum", () => {
    const parsed = triageSchema.safeParse({
      ...basePayload,
      time_sensitivity: {
        label: "NOW",
        miss_cost: "high"
      }
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts a valid triage payload", () => {
    const parsed = triageSchema.safeParse(basePayload);
    expect(parsed.success).toBe(true);
  });
});

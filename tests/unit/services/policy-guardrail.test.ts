import { describe, expect, it } from "vitest";
import { applyPolicyGuardrail } from "@/lib/services/policy-guardrail";

describe("applyPolicyGuardrail", () => {
  it("applies SAFE_MODE for high-risk domain", () => {
    const out = applyPolicyGuardrail({
      actionability: 95,
      hypeNoise: 10,
      missCost: "HIGH",
      recommendedAction: "READ_NOW",
      isHighRiskDomain: true
    });

    expect(out.finalLabel).toBe("LATER");
    expect(out.policyTrace.rule_id).toBe("SAFE_MODE");
    expect(out.policyTrace.consistency).toBe("ADJUSTED");
    expect(out.normalizedAction).toBe("SCHEDULE");
  });

  it("applies R1 for high actionability and low hype with high miss cost", () => {
    const out = applyPolicyGuardrail({
      actionability: 75,
      hypeNoise: 55,
      missCost: "HIGH",
      recommendedAction: "READ_NOW",
      isHighRiskDomain: false
    });

    expect(out.finalLabel).toBe("NOW");
    expect(out.policyTrace.rule_id).toBe("R1");
    expect(out.policyTrace.consistency).toBe("PASS");
    expect(out.normalizedAction).toBe("READ_NOW");
  });

  it("applies R2 and normalizes action to IGNORE for noisy low-actionability content", () => {
    const out = applyPolicyGuardrail({
      actionability: 30,
      hypeNoise: 85,
      missCost: "LOW",
      recommendedAction: "ASK_SOMEONE",
      isHighRiskDomain: false
    });

    expect(out.finalLabel).toBe("IGNORE");
    expect(out.policyTrace.rule_id).toBe("R2");
    expect(out.policyTrace.consistency).toBe("ADJUSTED");
    expect(out.normalizedAction).toBe("IGNORE");
  });

  it("falls back to R3 and keeps allowed action", () => {
    const out = applyPolicyGuardrail({
      actionability: 62,
      hypeNoise: 64,
      missCost: "MEDIUM",
      recommendedAction: "ASK_SOMEONE",
      isHighRiskDomain: false
    });

    expect(out.finalLabel).toBe("LATER");
    expect(out.policyTrace.rule_id).toBe("R3");
    expect(out.policyTrace.consistency).toBe("PASS");
    expect(out.normalizedAction).toBe("ASK_SOMEONE");
  });
});

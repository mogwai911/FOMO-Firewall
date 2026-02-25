export type FinalLabel = "NOW" | "LATER" | "IGNORE";
export type RecommendedAction = "READ_NOW" | "SCHEDULE" | "IGNORE" | "ASK_SOMEONE";
export type MissCost = "LOW" | "MEDIUM" | "HIGH";
export type RuleId = "SAFE_MODE" | "R1" | "R2" | "R3";

export interface GuardrailInput {
  actionability: number;
  hypeNoise: number;
  missCost: MissCost;
  recommendedAction: RecommendedAction;
  isHighRiskDomain: boolean;
}

export interface GuardrailOutput {
  finalLabel: FinalLabel;
  normalizedAction: RecommendedAction;
  policyTrace: {
    rule_id: RuleId;
    consistency: "PASS" | "ADJUSTED";
  };
}

const ALLOWED_ACTIONS: Record<FinalLabel, RecommendedAction[]> = {
  NOW: ["READ_NOW", "ASK_SOMEONE"],
  LATER: ["SCHEDULE", "ASK_SOMEONE"],
  IGNORE: ["IGNORE"]
};

const DEFAULT_ACTION: Record<FinalLabel, RecommendedAction> = {
  NOW: "READ_NOW",
  LATER: "SCHEDULE",
  IGNORE: "IGNORE"
};

function resolveFinalLabel(input: GuardrailInput): { finalLabel: FinalLabel; ruleId: RuleId } {
  if (input.isHighRiskDomain) {
    return { finalLabel: "LATER", ruleId: "SAFE_MODE" };
  }

  if (input.actionability >= 70 && input.hypeNoise <= 60 && input.missCost === "HIGH") {
    return { finalLabel: "NOW", ruleId: "R1" };
  }

  if (input.hypeNoise >= 75 && input.actionability <= 40) {
    return { finalLabel: "IGNORE", ruleId: "R2" };
  }

  return { finalLabel: "LATER", ruleId: "R3" };
}

export function applyPolicyGuardrail(input: GuardrailInput): GuardrailOutput {
  const { finalLabel, ruleId } = resolveFinalLabel(input);
  const isAllowed = ALLOWED_ACTIONS[finalLabel].includes(input.recommendedAction);

  return {
    finalLabel,
    normalizedAction: isAllowed ? input.recommendedAction : DEFAULT_ACTION[finalLabel],
    policyTrace: {
      rule_id: ruleId,
      consistency: isAllowed ? "PASS" : "ADJUSTED"
    }
  };
}

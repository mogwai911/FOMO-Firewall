export interface TriageProviderInput {
  role: "PM" | "ENG" | "RES";
  title?: string | null;
  url?: string | null;
  extractedText: string;
  repair?: boolean;
  invalidPayload?: unknown;
}

export interface TriageProvider {
  generateTriage(input: TriageProviderInput): Promise<unknown>;
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function inferScores(text: string): { actionability: number; hypeNoise: number; missCost: "LOW" | "MEDIUM" | "HIGH" } {
  let actionability = 50;
  let hypeNoise = 45;
  let missCost: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM";

  if (includesAny(text, ["tutorial", "guide", "step", "code", "example", "how to", "migration"])) {
    actionability += 22;
  }

  if (includesAny(text, ["breaking", "moon", "secret", "exclusive", "viral", "pump", "hype"])) {
    hypeNoise += 28;
  }

  if (includesAny(text, ["security", "legal", "medical", "investment", "compliance"])) {
    missCost = "HIGH";
    actionability += 8;
  }

  if (text.length < 200) {
    actionability -= 10;
    hypeNoise += 8;
  }

  return {
    actionability: clampScore(actionability),
    hypeNoise: clampScore(hypeNoise),
    missCost
  };
}

function pickAction(
  actionability: number,
  hypeNoise: number,
  missCost: "LOW" | "MEDIUM" | "HIGH",
  text: string
): "READ_NOW" | "SCHEDULE" | "IGNORE" | "ASK_SOMEONE" {
  if (actionability >= 70 && hypeNoise <= 60 && missCost === "HIGH") {
    return "READ_NOW";
  }

  if (hypeNoise >= 75 && actionability <= 40) {
    return "IGNORE";
  }

  if (includesAny(text, ["ask", "discuss", "team", "review"])) {
    return "ASK_SOMEONE";
  }

  if (actionability >= 70 && hypeNoise <= 60) {
    return "READ_NOW";
  }

  return "SCHEDULE";
}

function actionToLabel(action: "READ_NOW" | "SCHEDULE" | "IGNORE" | "ASK_SOMEONE"): "NOW" | "LATER" | "IGNORE" {
  if (action === "READ_NOW") {
    return "NOW";
  }

  if (action === "IGNORE") {
    return "IGNORE";
  }

  return "LATER";
}

function actionTask(action: "READ_NOW" | "SCHEDULE" | "IGNORE" | "ASK_SOMEONE"): {
  task: string;
  done_definition: string;
  estimated_minutes: number;
} {
  if (action === "READ_NOW") {
    return {
      task: "Read and extract one actionable takeaway",
      done_definition: "One concrete next step is written down",
      estimated_minutes: 20
    };
  }

  if (action === "ASK_SOMEONE") {
    return {
      task: "Ask one teammate for a 10-minute review",
      done_definition: "Question and context are sent to one specific person",
      estimated_minutes: 15
    };
  }

  if (action === "IGNORE") {
    return {
      task: "Record why this is noise for now",
      done_definition: "One sentence reason is logged",
      estimated_minutes: 10
    };
  }

  return {
    task: "Schedule one focused follow-up block",
    done_definition: "Calendar slot and expected output are defined",
    estimated_minutes: 15
  };
}

class HeuristicTriageProvider implements TriageProvider {
  async generateTriage(input: TriageProviderInput): Promise<unknown> {
    const text = input.extractedText.toLowerCase();
    const { actionability, hypeNoise, missCost } = inferScores(text);
    const recommendedAction = pickAction(actionability, hypeNoise, missCost, text);

    const reasons = [
      actionability >= 70 ? "Contains clear action steps." : "Action path is not fully clear yet.",
      hypeNoise >= 75 ? "Signal looks hype-heavy." : "Signal appears manageable.",
      missCost === "HIGH" ? "Missing this may be expensive." : "Missing this is likely reversible."
    ];

    return {
      role_fit: {
        pm: "Prioritize by user impact and delivery risk.",
        eng: "Focus on implementation details and migration cost.",
        res: "Focus on evidence quality and source reliability."
      },
      time_sensitivity: {
        label: actionToLabel(recommendedAction),
        miss_cost: missCost
      },
      scores: {
        actionability,
        hype_noise: hypeNoise
      },
      recommended_action: recommendedAction,
      one_step_task: actionTask(recommendedAction),
      reasons: reasons.slice(0, 3),
      policy_trace: {
        final_label: actionToLabel(recommendedAction),
        rule_id: "FALLBACK",
        consistency: "PASS"
      }
    };
  }
}

export const defaultTriageProvider: TriageProvider = new HeuristicTriageProvider();

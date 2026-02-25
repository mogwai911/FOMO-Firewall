export type RoleV2 = "PM" | "ENG" | "RES";
export type TriageLabel = "FYI" | "DO" | "DROP";
export type NextActionHint = "ENTER_SESSION" | "BOOKMARK" | "DISMISS";

export interface TriageReason {
  type: "source" | "verifiability" | "novelty" | "relevance" | "risk";
  text: string;
  confidence: number;
}

export interface TriageSnippet {
  text: string;
  source: "rss_summary" | "fetched_excerpt";
}

export interface TriageCardV2 {
  label: TriageLabel;
  headline: string;
  reasons: TriageReason[];
  snippets: TriageSnippet[];
  next_action_hint: NextActionHint;
  score: number;
}

export interface TriageSignalInput {
  title: string;
  summary: string | null;
  sourceName: string | null;
}

function trimSnippet(text: string): string {
  return text.length > 200 ? `${text.slice(0, 197)}...` : text;
}

function containsAny(input: string, tokens: string[]): boolean {
  return tokens.some((token) => input.includes(token));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roleSpecificReason(role: RoleV2): string {
  if (role === "PM") {
    return "优先评估对路线图与交付节奏的影响。";
  }
  if (role === "ENG") {
    return "优先评估实现复杂度、兼容性与运维风险。";
  }
  return "优先评估证据质量、可复现性与结论稳健性。";
}

function shortTitle(title: string): string {
  const normalized = title.trim();
  if (normalized.length <= 26) {
    return normalized;
  }
  return `${normalized.slice(0, 25)}…`;
}

export function generateHeuristicTriageCard(signal: TriageSignalInput, role: RoleV2): TriageCardV2 {
  const text = `${signal.title} ${signal.summary ?? ""}`.toLowerCase();
  const isRumor = containsAny(text, ["rumor", "speculation", "猜测", "传闻", "转载", "opinion"]);
  const isActionable = containsAny(text, [
    "release",
    "migration",
    "breaking",
    "deprecat",
    "security",
    "incident",
    "更新",
    "发布",
    "变更"
  ]);

  let label: TriageLabel = "FYI";
  if (isRumor) {
    label = "DROP";
  } else if (isActionable) {
    label = "DO";
  }

  const baseScore = label === "DO" ? 80 : label === "FYI" ? 55 : 20;
  const roleBias = role === "ENG" ? 5 : role === "PM" ? 0 : 3;
  const score = clampScore(baseScore + roleBias);

  const title = shortTitle(signal.title);
  const headline =
    label === "DO"
      ? `价值判断：${title} 可直接转化为执行动作或验证任务。建议：去学习。`
      : label === "FYI"
        ? `价值判断：${title} 主要提供背景增量，当前收益低于立即投入。建议：稍后看。`
        : `价值判断：${title} 与当前目标关联弱或噪声偏高。建议：忽略。`;

  const reasons: TriageReason[] = [
    {
      type: "relevance" as const,
      text:
        label === "DO"
          ? `${roleSpecificReason(role)} 当前价值是“可执行”，适合立即拆解下一步。`
          : label === "FYI"
            ? "当前主要价值是补充上下文认知，可作为后续决策背景。"
            : "继续跟进的机会成本高，短期难形成有效产出。",
      confidence: label === "DO" ? 0.82 : label === "FYI" ? 0.65 : 0.78
    },
    {
      type: "source" as const,
      text: signal.sourceName ? `来源：${signal.sourceName}` : "来源信息有限，需要谨慎采信。",
      confidence: signal.sourceName ? 0.74 : 0.52
    },
    {
      type: "verifiability" as const,
      text:
        label === "DROP"
          ? "证据链不完整且可替代信息充足，建议先忽略。"
          : "可通过原文核对或小范围实验在短时间完成验证。",
      confidence: label === "DROP" ? 0.71 : 0.69
    }
  ].slice(0, 3);

  const snippets = (signal.summary ? [trimSnippet(signal.summary)] : []).slice(0, 2).map((textItem) => ({
    text: textItem,
    source: "rss_summary" as const
  }));

  const next_action_hint: NextActionHint =
    label === "DO" ? "ENTER_SESSION" : label === "FYI" ? "BOOKMARK" : "DISMISS";

  return {
    label,
    headline,
    reasons,
    snippets,
    next_action_hint,
    score
  };
}

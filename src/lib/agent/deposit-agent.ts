export interface DepositMessage {
  role: "USER" | "ASSISTANT" | "TOOL";
  content: string;
}

export interface InsightCardDraft {
  version: 2;
  signal_title: string;
  abstract: string;
  key_points: string[];
  evidence: Array<{
    text: string;
    from: "conversation" | "rss_summary";
  }>;
  limitations: string[];
}

export interface EvidencePackDraft {
  summary: string;
  key_quotes: Array<{
    text: string;
    from: "conversation";
  }>;
  links: Array<{
    title?: string;
    url: string;
  }>;
  trace: {
    signal_id: string;
    session_id: string;
  };
}

interface BuildInsightCardInput {
  signalTitle: string;
  messages: DepositMessage[];
}

interface BuildEvidencePackInput {
  signalSummary: string | null;
  messages: DepositMessage[];
  signalId: string;
  sessionId: string;
}

function compactText(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function pickTailMessages(messages: DepositMessage[], count: number): DepositMessage[] {
  return messages.slice(Math.max(0, messages.length - count));
}

function toSentences(text: string): string[] {
  return text
    .split(/[。！？.!?]/)
    .map((line) => compactText(line))
    .filter((line) => line.length >= 8);
}

function uniqTake(lines: string[], max: number): string[] {
  const next: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (!line || seen.has(line)) {
      continue;
    }
    seen.add(line);
    next.push(line);
    if (next.length >= max) {
      break;
    }
  }
  return next;
}

export function buildInsightCard(input: BuildInsightCardInput): InsightCardDraft {
  const recent = pickTailMessages(input.messages, 8);
  const assistantTexts = recent
    .filter((item) => item.role === "ASSISTANT")
    .map((item) => compactText(item.content))
    .filter(Boolean);
  const userTexts = recent
    .filter((item) => item.role === "USER")
    .map((item) => compactText(item.content))
    .filter(Boolean);

  const seedText =
    assistantTexts[0] ?? userTexts[0] ?? `围绕「${input.signalTitle}」提炼关键洞察与局限。`;
  const abstract = seedText;

  const keyPointPool = uniqTake(
    [...assistantTexts.flatMap(toSentences), ...userTexts.flatMap(toSentences), abstract],
    5
  );
  while (keyPointPool.length < 3) {
    keyPointPool.push(`围绕「${input.signalTitle}」仍缺乏可直接验证的关键事实。`);
  }

  const evidencePool: InsightCardDraft["evidence"] = uniqTake(
    [...assistantTexts, ...userTexts, abstract],
    4
  ).map((text) => ({
    text,
    from: "conversation" as const
  }));
  if (evidencePool.length === 0) {
    evidencePool.push({
      text: `当前会话信息不足：尚未沉淀「${input.signalTitle}」的可复核证据。`,
      from: "rss_summary"
    });
  }

  const limitationPool = uniqTake(
    [
      "当前结论主要来自会话抽样，缺少跨来源交叉验证。",
      "原文中未覆盖完整背景，可能遗漏边界条件。",
      "若后续出现反例或新增数据，需重新审视该洞察。"
    ],
    3
  );

  return {
    version: 2,
    signal_title: input.signalTitle,
    abstract,
    key_points: keyPointPool.slice(0, 5),
    evidence: evidencePool.slice(0, 4),
    limitations: limitationPool
  };
}

export function buildEvidencePack(input: BuildEvidencePackInput): EvidencePackDraft {
  const tail = pickTailMessages(input.messages, 4);
  const summary = compactText(
    tail.map((item) => item.content).join(" ").slice(0, 240) ||
      input.signalSummary ||
      "暂无摘要，建议继续会话补充上下文。"
  );

  return {
    summary,
    key_quotes: tail.slice(0, 3).map((item) => ({
      text: compactText(item.content),
      from: "conversation" as const
    })),
    links: [],
    trace: {
      signal_id: input.signalId,
      session_id: input.sessionId
    }
  };
}

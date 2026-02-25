interface QuestionSignalInput {
  title: string;
  summary: string | null;
  aiSummary?: string | null;
}

interface QuestionMessageInput {
  role: "USER" | "ASSISTANT" | "TOOL";
  content: string;
}

export interface SessionQuestionInput {
  signal: QuestionSignalInput;
  messages: QuestionMessageInput[];
}

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function clip(text: string, limit = 28): string {
  const normalized = compact(text);
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, limit - 1))}…`;
}

function findLatestUserMessage(messages: QuestionMessageInput[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "USER") {
      return compact(message.content);
    }
  }
  return null;
}

function hasMigrationIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("迁移") ||
    lower.includes("migration") ||
    lower.includes("upgrade") ||
    lower.includes("改造")
  );
}

export function generateSessionQuestionCards(input: SessionQuestionInput): string[] {
  const title = clip(input.signal.title, 36) || "该线索";
  const summarySeed = input.signal.aiSummary ?? input.signal.summary;
  const summary = summarySeed ? clip(summarySeed, 42) : "";
  const topicSeed = summary || title;
  const topic = clip(topicSeed, 26);
  const latestUser = findLatestUserMessage(input.messages);

  const cards: string[] = [];
  if (latestUser) {
    if (hasMigrationIntent(latestUser)) {
      cards.push(`围绕“迁移路径”，我下一步最小验证动作是什么？`);
      cards.push(`迁移路径里最容易出错的兼容点是哪些？`);
    } else {
      cards.push(`围绕“${clip(latestUser, 18)}”，我下一步最小验证动作是什么？`);
      cards.push(`这条路径最关键的验收指标应该怎么定义？`);
    }
  } else {
    cards.push(
      summary ? `围绕“${clip(summary, 24)}”，最小可执行验证动作是什么？` : `针对《${title}》，最小验证步骤是什么？`
    );
    cards.push(`围绕“${topic}”，最先要补齐的关键证据是什么？`);
  }

  cards.push(summary ? `结合“${summary}”，哪种信号出现时应立即停止投入？` : `如果失败，回滚点在哪里？`);
  cards.push(`什么时候应该把《${title}》改判为“稍后看”或“忽略”？`);

  const unique = Array.from(new Set(cards.map((card) => compact(card)).filter(Boolean)));
  return unique.slice(0, 3);
}

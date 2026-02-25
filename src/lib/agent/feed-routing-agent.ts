export type FeedRoutingRole = "PM" | "ENG" | "RES";
export type FeedRoutingLabel = "FYI" | "DO" | "DROP";

export interface FeedRoutingInputItem {
  id: string;
  title: string;
  summary: string | null;
  sourceName: string | null;
  publishedAt: string | null;
  baseScore: number;
}

export interface FeedRoutingOutputItem {
  id: string;
  rankScore: number;
}

function normalizeTitleKey(title: string): string {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function containsAny(input: string, tokens: string[]): boolean {
  return tokens.some((token) => input.includes(token));
}

function decideLabel(title: string, summary: string | null): FeedRoutingLabel {
  const text = `${title} ${summary ?? ""}`.toLowerCase();
  if (containsAny(text, ["rumor", "speculation", "猜测", "传闻", "小道消息"])) {
    return "DROP";
  }
  if (
    containsAny(text, [
      "breaking",
      "migration",
      "security",
      "incident",
      "api",
      "发布",
      "变更",
      "上线"
    ])
  ) {
    return "DO";
  }
  return "FYI";
}

function roleBoost(role: FeedRoutingRole, title: string, summary: string | null): number {
  const text = `${title} ${summary ?? ""}`.toLowerCase();
  if (role === "ENG" && containsAny(text, ["api", "runtime", "breaking", "security", "迁移"])) {
    return 6;
  }
  if (role === "PM" && containsAny(text, ["roadmap", "launch", "产品", "增长", "交付"])) {
    return 6;
  }
  if (role === "RES" && containsAny(text, ["paper", "benchmark", "评测", "实验", "复现"])) {
    return 6;
  }
  return 0;
}

function labelBoost(label: FeedRoutingLabel): number {
  if (label === "DO") return 10;
  if (label === "FYI") return 2;
  return -8;
}

export function routeFeedsForDigest(input: {
  role: FeedRoutingRole;
  limit: number;
  feeds: FeedRoutingInputItem[];
}): {
  items: FeedRoutingOutputItem[];
  byId: Record<string, { label: FeedRoutingLabel; rankScore: number }>;
} {
  const dedupeMap = new Map<string, FeedRoutingInputItem>();
  for (const feed of input.feeds) {
    const key = normalizeTitleKey(feed.title);
    const existing = dedupeMap.get(key);
    if (!existing || feed.baseScore > existing.baseScore) {
      dedupeMap.set(key, feed);
    }
  }

  const byId: Record<string, { label: FeedRoutingLabel; rankScore: number }> = {};
  const ranked = Array.from(dedupeMap.values()).map((feed) => {
    const label = decideLabel(feed.title, feed.summary);
    const rankScore = Math.round(
      feed.baseScore + roleBoost(input.role, feed.title, feed.summary) + labelBoost(label)
    );
    byId[feed.id] = {
      label,
      rankScore
    };
    return {
      id: feed.id,
      rankScore,
      label
    };
  });

  ranked.sort((a, b) => b.rankScore - a.rankScore);
  const limit = Math.max(1, Math.min(100, Math.floor(input.limit)));
  return {
    items: ranked.slice(0, limit).map((row) => ({ id: row.id, rankScore: row.rankScore })),
    byId
  };
}

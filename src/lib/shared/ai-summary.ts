function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const compacted = compactText(value);
  return compacted.length > 0 ? compacted : null;
}

export function extractTriageHeadline(triageJson: unknown): string | null {
  if (!triageJson || typeof triageJson !== "object" || Array.isArray(triageJson)) {
    return null;
  }
  const headline = (triageJson as { headline?: unknown }).headline;
  return typeof headline === "string" ? normalizeText(headline) : null;
}

export function pickAiSummaryText(input: {
  aiSummary?: string | null;
  triageHeadline?: string | null;
  summary?: string | null;
  emptyText?: string;
}): string {
  const preferred = normalizeText(input.aiSummary);
  if (preferred) {
    return preferred;
  }
  const triageHeadline = normalizeText(input.triageHeadline);
  if (triageHeadline) {
    return triageHeadline;
  }
  const fallback = normalizeText(input.summary);
  if (fallback) {
    return fallback;
  }
  return input.emptyText ?? "暂无AI总结";
}

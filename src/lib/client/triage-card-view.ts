import type {
  DispositionLabel,
  TriageCardView,
  TriageNextActionHint,
  TriageReasonType,
  TriageSnippetSource
} from "@/lib/client/app-types";

type UnknownRecord = Record<string, unknown>;

const LABEL_SET = new Set<DispositionLabel>(["FYI", "DO", "DROP"]);
const NEXT_ACTION_SET = new Set<TriageNextActionHint>(["ENTER_SESSION", "BOOKMARK", "DISMISS"]);
const REASON_TYPE_SET = new Set<TriageReasonType>([
  "source",
  "verifiability",
  "novelty",
  "relevance",
  "risk"
]);
const SNIPPET_SOURCE_SET = new Set<TriageSnippetSource>(["rss_summary", "fetched_excerpt"]);

function sanitizeDispositionWording(text: string): string {
  return text.replace(/\bFYI\b/gi, "稍后看");
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function toLabel(value: unknown): DispositionLabel | null {
  return typeof value === "string" && LABEL_SET.has(value as DispositionLabel)
    ? (value as DispositionLabel)
    : null;
}

function toNextAction(value: unknown): TriageNextActionHint | null {
  return typeof value === "string" && NEXT_ACTION_SET.has(value as TriageNextActionHint)
    ? (value as TriageNextActionHint)
    : null;
}

function toReason(item: unknown): { type: TriageReasonType; text: string; confidence: number } | null {
  if (!isRecord(item)) {
    return null;
  }

  const type = item.type;
  const text = item.text;
  const confidence = item.confidence;
  if (
    typeof type !== "string" ||
    !REASON_TYPE_SET.has(type as TriageReasonType) ||
    typeof text !== "string" ||
    text.trim().length === 0 ||
    typeof confidence !== "number" ||
    !Number.isFinite(confidence)
  ) {
    return null;
  }

  return {
    type: type as TriageReasonType,
    text: sanitizeDispositionWording(text.trim()),
    confidence
  };
}

function toSnippet(item: unknown): { text: string; source: TriageSnippetSource } | null {
  if (!isRecord(item)) {
    return null;
  }
  const text = item.text;
  const source = item.source;
  if (
    typeof text !== "string" ||
    text.trim().length === 0 ||
    typeof source !== "string" ||
    !SNIPPET_SOURCE_SET.has(source as TriageSnippetSource)
  ) {
    return null;
  }

  return {
    text: sanitizeDispositionWording(text.trim()),
    source: source as TriageSnippetSource
  };
}

export function parseTriageCardView(value: unknown): TriageCardView | null {
  if (!isRecord(value)) {
    return null;
  }

  const label = toLabel(value.label);
  const headline =
    typeof value.headline === "string" ? sanitizeDispositionWording(value.headline.trim()) : "";
  const nextActionHint = toNextAction(value.next_action_hint);
  const score = typeof value.score === "number" && Number.isFinite(value.score) ? value.score : null;

  if (!label || !headline || !nextActionHint || score === null) {
    return null;
  }

  const reasonsRaw = Array.isArray(value.reasons) ? value.reasons : [];
  const reasons = reasonsRaw.map(toReason).filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 3);

  const snippetsRaw = Array.isArray(value.snippets) ? value.snippets : [];
  const snippets = snippetsRaw
    .map(toSnippet)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 2);

  return {
    label,
    headline,
    reasons,
    snippets,
    nextActionHint,
    score: Math.max(0, Math.min(100, Math.round(score)))
  };
}

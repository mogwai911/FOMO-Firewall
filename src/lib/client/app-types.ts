export type DispositionLabel = "FYI" | "DO" | "DROP";
export type SessionStatusV2 = "ACTIVE" | "PAUSED" | "CLOSED";
export type MessageRoleInput = "user" | "assistant" | "tool";
export type MessageRoleView = "USER" | "ASSISTANT" | "TOOL";
export type JobTypeV2 = "INSIGHT_CARD" | "EVIDENCE_PACK";
export type JobStatusV2 = "QUEUED" | "RUNNING" | "DONE" | "FAILED";
export type RoleV2 = "PM" | "ENG" | "RES";
export type TriageReasonType =
  | "source"
  | "verifiability"
  | "novelty"
  | "relevance"
  | "risk";
export type TriageSnippetSource = "rss_summary" | "fetched_excerpt";
export type TriageNextActionHint = "ENTER_SESSION" | "BOOKMARK" | "DISMISS";

export interface DigestSignal {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  source: {
    id: string;
    name: string | null;
  };
  disposition: DispositionLabel | null;
  triage: unknown;
  routing: {
    label: DispositionLabel;
    score: number;
  };
}

export interface DigestPayload {
  dateKey: string;
  count: number;
  signals: DigestSignal[];
}

export interface DigestCountsView {
  total: number;
  pending: number;
  processed: number;
  later: number;
  do: number;
  drop: number;
}

export interface DigestLastRefreshView {
  ingestion: {
    sources: number;
    signals: number;
    duplicates: number;
    errors: number;
    errorDetails?: Array<{
      sourceId: string;
      sourceName: string | null;
      rssUrl: string;
      message: string;
    }>;
  };
  triage: {
    requested: number;
    generated: number;
    failed: number;
  };
}

export interface DigestViewResponse {
  hasSnapshot: boolean;
  digest: DigestPayload;
  counts: DigestCountsView;
  lastRefresh: DigestLastRefreshView | null;
  generatedAt: string | null;
  legacyDigestRunExists: boolean;
  legacyNotice: string | null;
}

export type DigestResetMode = "PRESERVE_DISPOSITIONS" | "RESET_DISPOSITIONS";
export type DigestWindowDays = 1 | 3 | 7;

export interface DigestStatusView {
  hasDigest: boolean;
  generatedAt: string | null;
  signalCount: number;
  processedCount: number;
}

export interface DigestIngestionSummary {
  sources: number;
  signals: number;
  duplicates: number;
  errors: Array<{
    sourceId: string;
    sourceName: string | null;
    rssUrl: string;
    message: string;
  }>;
}

export interface DigestTriageSummary {
  requested: number;
  generated: number;
  failed: number;
  errors: Array<{ signalId: string; message: string }>;
}

export interface FyiSignalView {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  dispositionUpdatedAt: string;
  source: {
    id: string;
    name: string | null;
  };
}

export interface TriageReasonView {
  type: TriageReasonType;
  text: string;
  confidence: number;
}

export interface TriageSnippetView {
  text: string;
  source: TriageSnippetSource;
}

export interface TriageCardView {
  label: DispositionLabel;
  headline: string;
  reasons: TriageReasonView[];
  snippets: TriageSnippetView[];
  nextActionHint: TriageNextActionHint;
  score: number;
}

export interface UserProfileView {
  role: RoleV2;
  timeBudgetMinutes: number | null;
  hypeWords: string[];
}

export interface AppSettingsView {
  schedule: {
    enabled: boolean;
    time: string;
    timezone: string;
  };
  apiConfig: {
    baseUrl: string;
    apiKey: string;
    model: string;
    hasApiKey?: boolean;
    apiKeyMasked?: string | null;
  };
  prompts?: {
    triage: string;
    sessionAssistant: string;
    suggestedQuestions?: string;
  };
  updatedAt: string;
}

export interface DispositionPayload {
  id: string;
  signalId: string;
  label: DispositionLabel;
  isOverride: boolean;
  updatedAt: string;
}

export interface SessionSummary {
  id: string;
  signalId: string;
  status: SessionStatusV2;
  createdAt: string;
  updatedAt: string;
}

export interface SessionListItemView {
  id: string;
  status: SessionStatusV2;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  signal: {
    id: string;
    title: string;
    summary: string | null;
    aiSummary: string;
    source: {
      id: string;
      name: string | null;
    };
  };
}

export interface SessionMessageView {
  id: string;
  sessionId: string;
  role: MessageRoleView;
  content: string;
  metaJson: unknown;
  createdAt: string;
}

export interface SessionStreamAckEvent {
  userMessage: SessionMessageView;
}

export interface SessionStreamDeltaEvent {
  text: string;
}

export interface SessionStreamDoneEvent {
  assistantMessage: SessionMessageView;
}

export interface SessionStreamErrorEvent {
  code: string;
  message: string;
}

export interface SessionJobView {
  id: string;
  sessionId: string;
  type: JobTypeV2;
  status: JobStatusV2;
  error: string | null;
  resultRefJson: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface SessionDetail {
  id: string;
  status: SessionStatusV2;
  createdAt: string;
  updatedAt: string;
  signal: {
    id: string;
    title: string;
    summary: string | null;
    url: string;
    source: {
      id: string;
      name: string | null;
    };
  };
  messages: SessionMessageView[];
  jobs: SessionJobView[];
}

export interface SessionSuggestedQuestionsView {
  questions: string[];
  mode: "LLM" | "HEURISTIC";
  warnings: string[];
}

export interface InsightCardView {
  id: string;
  sessionId: string;
  signalId: string;
  insightJson: unknown;
  createdAt: string;
}

export interface EvidencePackSummaryView {
  id: string;
  sessionId: string | null;
  signalId: string;
  packJson: unknown;
  createdAt: string;
}

export interface EvidencePackDetailView {
  id: string;
  sessionId: string | null;
  sessionAvailable: boolean;
  signalId: string;
  createdAt: string;
  summary: string;
  keyQuotes: string[];
  links: string[];
  trace: unknown;
  transcript: Array<{
    id: string;
    role: MessageRoleView;
    content: string;
    createdAt: string;
  }>;
}

export interface SignalPreviewView {
  signalId: string;
  title: string;
  sourceName: string | null;
  originalUrl: string;
  aiSummary: string;
  aiSummaryMode: "LLM" | "HEURISTIC";
  articleContent: string | null;
  warnings: string[];
  generatedAt: string;
}

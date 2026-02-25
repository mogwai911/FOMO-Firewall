import type {
  AppSettingsView,
  DigestIngestionSummary,
  DigestPayload,
  DigestViewResponse,
  DigestResetMode,
  DigestStatusView,
  DigestTriageSummary,
  DigestWindowDays,
  DispositionLabel,
  DispositionPayload,
  EvidencePackDetailView,
  EvidencePackSummaryView,
  FyiSignalView,
  JobTypeV2,
  InsightCardView,
  MessageRoleInput,
  RoleV2,
  SignalPreviewView,
  SessionDetail,
  SessionListItemView,
  SessionJobView,
  SessionStreamAckEvent,
  SessionStreamDeltaEvent,
  SessionStreamDoneEvent,
  SessionStreamErrorEvent,
  SessionSuggestedQuestionsView,
  SessionStatusV2,
  SessionSummary,
  TriageCardView,
  UserProfileView
} from "@/lib/client/app-types";

interface ApiErrorPayload {
  error?: string;
  message?: string;
}

export class AppApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const json = (await response.json()) as T | ApiErrorPayload;
  if (response.ok) {
    return json as T;
  }

  const errorPayload = json as ApiErrorPayload;
  const code = typeof errorPayload.error === "string" ? errorPayload.error : "API_ERROR";
  const message = typeof errorPayload.message === "string" ? errorPayload.message : code;
  throw new AppApiError(response.status, code, message);
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

export async function fetchDigest(
  dateKey: string,
  windowDays?: DigestWindowDays
): Promise<DigestViewResponse> {
  const query = buildQuery({
    windowDays
  });
  const response = await fetch(`/api/digest/${dateKey}${query}`, {
    cache: "no-store"
  });
  return parseJson<DigestViewResponse>(response);
}

export async function fetchDigestStatus(
  dateKey: string,
  windowDays?: DigestWindowDays
): Promise<DigestStatusView> {
  const query = buildQuery({
    windowDays
  });
  const response = await fetch(`/api/digest/${dateKey}/status${query}`, {
    cache: "no-store"
  });
  const json = await parseJson<{ status: DigestStatusView }>(response);
  return json.status;
}

export async function manualRefreshDigest(input: {
  dateKey: string;
  overwrite?: boolean;
  resetMode?: DigestResetMode;
  role?: RoleV2;
  timezone?: string;
  windowDays?: DigestWindowDays;
  limit?: number;
  keepalive?: boolean;
}): Promise<{
  status: DigestStatusView;
  digest: DigestPayload;
  ingestionSummary: DigestIngestionSummary;
  triageSummary: DigestTriageSummary;
}> {
  const response = await fetch(`/api/digest/${input.dateKey}/manual-refresh`, {
    method: "POST",
    keepalive: input.keepalive,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      overwrite: input.overwrite,
      resetMode: input.resetMode,
      role: input.role,
      timezone: input.timezone,
      windowDays: input.windowDays,
      limit: input.limit
    })
  });
  return parseJson<{
    status: DigestStatusView;
    digest: DigestPayload;
    ingestionSummary: DigestIngestionSummary;
    triageSummary: DigestTriageSummary;
  }>(response);
}

export async function fetchProfile(): Promise<UserProfileView> {
  const response = await fetch("/api/profile", {
    cache: "no-store"
  });
  return parseJson<UserProfileView>(response);
}

export async function saveProfile(input: {
  role: RoleV2;
  timeBudgetMinutes?: number | null;
  hypeWords?: string[] | null;
}): Promise<UserProfileView> {
  const response = await fetch("/api/profile", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      role: input.role,
      timeBudgetMinutes: input.timeBudgetMinutes ?? null,
      hypeWords: input.hypeWords ?? null
    })
  });
  return parseJson<UserProfileView>(response);
}

export async function fetchAppSettings(): Promise<AppSettingsView> {
  const response = await fetch("/api/settings", {
    cache: "no-store"
  });
  const json = await parseJson<{ settings: AppSettingsView }>(response);
  return json.settings;
}

export async function saveAppSettings(input: {
  schedule: {
    enabled: boolean;
    time: string;
    timezone: string;
  };
  apiConfig: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  prompts?: {
    triage: string;
    sessionAssistant: string;
    suggestedQuestions?: string;
  };
}): Promise<AppSettingsView> {
  const response = await fetch("/api/settings", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const json = await parseJson<{ settings: AppSettingsView }>(response);
  return json.settings;
}

export async function generateSignalTriage(
  signalId: string,
  role: RoleV2 = "ENG"
): Promise<TriageCardView> {
  const response = await fetch(`/api/signals/${signalId}/triage`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      role
    })
  });
  const json = await parseJson<{
    triageId: string;
    triage: {
      label: "FYI" | "DO" | "DROP";
      headline: string;
      reasons: Array<{
        type: "source" | "verifiability" | "novelty" | "relevance" | "risk";
        text: string;
        confidence: number;
      }>;
      snippets: Array<{
        text: string;
        source: "rss_summary" | "fetched_excerpt";
      }>;
      next_action_hint: "ENTER_SESSION" | "BOOKMARK" | "DISMISS";
      score: number;
    };
  }>(response);
  return {
    label: json.triage.label,
    headline: json.triage.headline,
    reasons: json.triage.reasons,
    snippets: json.triage.snippets,
    nextActionHint: json.triage.next_action_hint,
    score: json.triage.score
  };
}

export async function setSignalDisposition(
  signalId: string,
  label: DispositionLabel
): Promise<DispositionPayload> {
  const response = await fetch(`/api/signals/${signalId}/disposition`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      label
    })
  });
  const json = await parseJson<{ disposition: DispositionPayload }>(response);
  return json.disposition;
}

export async function trackSignalEvent(input: {
  signalId: string;
  type: "TRIAGE_EXPANDED";
  payloadJson?: unknown;
}): Promise<void> {
  const response = await fetch(`/api/signals/${input.signalId}/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      type: input.type,
      payloadJson: input.payloadJson
    })
  });
  await parseJson<{ event: { id: string } }>(response);
}

export async function fetchSignalPreview(signalId: string): Promise<SignalPreviewView> {
  const response = await fetch(`/api/signals/${signalId}/preview`, {
    cache: "no-store"
  });
  const json = await parseJson<{ preview: SignalPreviewView }>(response);
  return json.preview;
}

export async function createOrResumeSession(signalId: string): Promise<SessionSummary> {
  const response = await fetch("/api/sessions", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      signalId
    })
  });
  const json = await parseJson<{ session: SessionSummary }>(response);
  return json.session;
}

export async function enterSessionFromSignal(signalId: string): Promise<{
  disposition: DispositionPayload;
  session: SessionSummary;
}> {
  const response = await fetch(`/api/signals/${signalId}/enter-session`, {
    method: "POST"
  });
  return parseJson<{
    disposition: DispositionPayload;
    session: SessionSummary;
  }>(response);
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail> {
  const response = await fetch(`/api/sessions/${sessionId}`, {
    cache: "no-store"
  });
  const json = await parseJson<{ session: SessionDetail }>(response);
  return json.session;
}

export async function fetchSessionSuggestedQuestions(
  sessionId: string
): Promise<SessionSuggestedQuestionsView> {
  const response = await fetch(`/api/sessions/${sessionId}/suggested-questions`, {
    cache: "no-store"
  });
  const json = await parseJson<{ suggestedQuestions: SessionSuggestedQuestionsView }>(response);
  return json.suggestedQuestions;
}

export async function fetchSessionList(input?: {
  limit?: number;
  statuses?: SessionStatusV2[];
}): Promise<SessionListItemView[]> {
  const query = buildQuery({
    limit: input?.limit,
    status: input?.statuses?.join(",")
  });
  const response = await fetch(`/api/sessions${query}`, {
    cache: "no-store"
  });
  const json = await parseJson<{ sessions: SessionListItemView[] }>(response);
  return json.sessions;
}

export async function deleteSession(sessionId: string): Promise<{ id: string }> {
  const response = await fetch(`/api/sessions/${sessionId}`, {
    method: "DELETE"
  });
  const json = await parseJson<{ deleted: { id: string } }>(response);
  return json.deleted;
}

export async function setSessionStatus(
  sessionId: string,
  status: SessionStatusV2
): Promise<SessionSummary> {
  const response = await fetch(`/api/sessions/${sessionId}/status`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      status
    })
  });
  const json = await parseJson<{ session: SessionSummary }>(response);
  return json.session;
}

export async function appendSessionMessage(input: {
  sessionId: string;
  role: MessageRoleInput;
  content: string;
  metaJson?: unknown;
}): Promise<{
  id: string;
  sessionId: string;
  role: "USER" | "ASSISTANT" | "TOOL";
  content: string;
  metaJson: unknown;
  createdAt: string;
}> {
  const response = await fetch(`/api/sessions/${input.sessionId}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      role: input.role,
      content: input.content,
      metaJson: input.metaJson
    })
  });
  const json = await parseJson<{
    message: {
      id: string;
      sessionId: string;
      role: "USER" | "ASSISTANT" | "TOOL";
      content: string;
      metaJson: unknown;
      createdAt: string;
    };
  }>(response);
  return json.message;
}

function parseSseFrame(lines: string[]): { event: string; payload: unknown } | null {
  let event = "message";
  const dataParts: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataParts.push(line.slice("data:".length).trim());
    }
  }

  if (dataParts.length === 0) {
    return null;
  }

  const data = dataParts.join("\n");
  try {
    return {
      event,
      payload: JSON.parse(data)
    };
  } catch {
    throw new AppApiError(500, "STREAM_PARSE_FAILED", "invalid stream payload");
  }
}

export async function streamSessionAssistantReply(
  input: {
    sessionId: string;
    content: string;
    metaJson?: unknown;
    signal?: AbortSignal;
    onAck?: (payload: SessionStreamAckEvent) => void;
    onDelta?: (payload: SessionStreamDeltaEvent) => void;
    onDone?: (payload: SessionStreamDoneEvent) => void;
    onError?: (payload: SessionStreamErrorEvent) => void;
  },
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const response = await fetchImpl(`/api/sessions/${input.sessionId}/messages/stream`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      role: "user",
      content: input.content,
      metaJson: input.metaJson
    }),
    signal: input.signal
  });

  if (!response.ok) {
    await parseJson<unknown>(response);
    return;
  }

  if (!response.body) {
    throw new AppApiError(500, "STREAM_BODY_MISSING", "stream body missing");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let frameLines: string[] = [];
  let shouldStop = false;

  while (!shouldStop) {
    const { value, done } = await reader.read();
    if (done) {
      buffer += decoder.decode();
    } else if (value) {
      buffer += decoder.decode(value, { stream: true });
    }

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);

      if (line === "") {
        const frame = parseSseFrame(frameLines);
        frameLines = [];
        if (frame) {
          if (frame.event === "ack" && input.onAck) {
            input.onAck(frame.payload as SessionStreamAckEvent);
          } else if (frame.event === "delta" && input.onDelta) {
            input.onDelta(frame.payload as SessionStreamDeltaEvent);
          } else if (frame.event === "done" && input.onDone) {
            input.onDone(frame.payload as SessionStreamDoneEvent);
          } else if (frame.event === "error") {
            input.onError?.(frame.payload as SessionStreamErrorEvent);
            shouldStop = true;
          }
        }
      } else {
        frameLines.push(line);
      }

      newlineIndex = buffer.indexOf("\n");
    }

    if (done) {
      const remainder = buffer.trim();
      if (remainder.length > 0) {
        frameLines.push(remainder);
      }
      const finalFrame = parseSseFrame(frameLines);
      if (finalFrame) {
        if (finalFrame.event === "ack" && input.onAck) {
          input.onAck(finalFrame.payload as SessionStreamAckEvent);
        } else if (finalFrame.event === "delta" && input.onDelta) {
          input.onDelta(finalFrame.payload as SessionStreamDeltaEvent);
        } else if (finalFrame.event === "done" && input.onDone) {
          input.onDone(finalFrame.payload as SessionStreamDoneEvent);
        } else if (finalFrame.event === "error") {
          input.onError?.(finalFrame.payload as SessionStreamErrorEvent);
        }
      }
      break;
    }
  }
}

export async function startSessionJob(input: {
  sessionId: string;
  type: JobTypeV2;
  runNow?: boolean;
}): Promise<SessionJobView> {
  const response = await fetch(`/api/sessions/${input.sessionId}/jobs`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      type: input.type,
      runNow: input.runNow
    })
  });
  const json = await parseJson<{ job: SessionJobView }>(response);
  return json.job;
}

export async function fetchInsightCards(input?: {
  sessionId?: string;
  limit?: number;
}): Promise<InsightCardView[]> {
  const query = buildQuery({
    sessionId: input?.sessionId,
    limit: input?.limit
  });
  const response = await fetch(`/api/insight_cards${query}`, { cache: "no-store" });
  const json = await parseJson<{ cards: InsightCardView[] }>(response);
  return json.cards;
}

export async function deleteInsightCard(insightCardId: string): Promise<{ id: string }> {
  const response = await fetch(`/api/insight_cards/${insightCardId}`, {
    method: "DELETE"
  });
  const json = await parseJson<{ deleted: { id: string } }>(response);
  return json.deleted;
}

export async function fetchEvidencePacks(input?: {
  sessionId?: string;
  limit?: number;
}): Promise<EvidencePackSummaryView[]> {
  const query = buildQuery({
    sessionId: input?.sessionId,
    limit: input?.limit
  });
  const response = await fetch(`/api/evidence_packs${query}`, { cache: "no-store" });
  const json = await parseJson<{ packs: EvidencePackSummaryView[] }>(response);
  return json.packs;
}

export async function fetchEvidencePackDetail(evidenceId: string): Promise<EvidencePackDetailView> {
  const response = await fetch(`/api/evidence_packs/${evidenceId}`, { cache: "no-store" });
  const json = await parseJson<{ pack: EvidencePackDetailView }>(response);
  return json.pack;
}

export async function fetchFyiSignals(limit = 30): Promise<FyiSignalView[]> {
  const query = buildQuery({ limit });
  const response = await fetch(`/api/signals/fyi${query}`, {
    cache: "no-store"
  });
  const json = await parseJson<{ signals: FyiSignalView[] }>(response);
  return json.signals;
}

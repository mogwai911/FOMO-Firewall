import { useSyncExternalStore } from "react";
import { clearPersistedSettings, writePersistedSettings } from "@/lib/settings-store";

export type TriageStatus = "ready" | "pending";
export type Disposition = "UNSET" | "FYI" | "DO" | "DROP";
export type SessionStatus = "active" | "paused";
export type JobKind = "flashcards" | "evidence";
export type JobStatus = "queued" | "running" | "done" | "failed";
export type JobStatusView = JobStatus | "idle";

export interface SourceItem {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface RssSourceSetting {
  id: string;
  name: string;
  url: string;
  tags: string[];
  enabled: boolean;
  createdAt: string;
}

export interface DigestScheduleSetting {
  enabled: boolean;
  time: string;
  timezone: string;
}

export interface ApiConfigSetting {
  baseUrl: string;
  apiKey: string;
}

export interface MockSettings {
  rssSources: RssSourceSetting[];
  schedule: DigestScheduleSetting;
  apiConfig: ApiConfigSetting;
}

export interface SignalItem {
  id: string;
  title: string;
  source: string;
  sourceId: string;
  publishedAt: string;
  summary: string;
  triageStatus: TriageStatus;
  recommendation: Disposition;
  headline?: string;
  reasons?: string[];
  snippets?: string[];
  nextActionHint?: string;
  originalUrl: string;
}

export interface SessionItem {
  id: string;
  signalId: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface JobItem {
  id: string;
  sessionId: string;
  kind: JobKind;
  status: JobStatus;
  resultId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryCard {
  id: string;
  sessionId: string;
  signalId: string;
  question: string;
  answer: string;
  source: string;
  evidenceId?: string;
  createdAt: string;
}

export interface EvidencePack {
  id: string;
  sessionId: string;
  signalId: string;
  summary: string;
  quotes: string[];
  links: string[];
  createdAt: string;
}

export interface MockState {
  settings: MockSettings;
  sources: SourceItem[];
  signals: SignalItem[];
  dispositions: Record<string, Disposition>;
  sessions: SessionItem[];
  sessionMessages: SessionMessage[];
  jobs: JobItem[];
  memoryCards: MemoryCard[];
  evidencePacks: EvidencePack[];
}

export interface PersistedState {
  version: number;
  state: MockState;
}

export interface AddRssSourceInput {
  url: string;
  name?: string;
  tags?: string[];
}

export interface AddRssSourceResult {
  ok: boolean;
  reason?: "invalid_url" | "duplicate";
  existingId?: string;
}

export interface SaveApiConfigInput {
  baseUrl: string;
  apiKey: string;
}

export interface SaveApiConfigResult {
  ok: boolean;
  reason?: "invalid_url" | "empty_key";
}

const DEFAULT_DIGEST_SOURCES: Array<{ id: string; name: string; url: string }> = [
  {
    id: "default-openai",
    name: "OpenAI Blog",
    url: "https://openai.com/blog/rss.xml"
  },
  {
    id: "default-vercel",
    name: "Vercel Updates",
    url: "https://vercel.com/changelog/rss.xml"
  },
  {
    id: "default-mirror",
    name: "Industry Mirror",
    url: "https://example.com/mirror.xml"
  }
];

const SIGNAL_TEMPLATES: Array<Omit<SignalItem, "source" | "sourceId" | "originalUrl">> = [
  {
    id: "signal-alpha",
    title: "OpenAI 发布 API 变更说明",
    publishedAt: "09:10",
    summary: "摘要：新增推理能力参数，并更新调用建议。",
    triageStatus: "ready",
    recommendation: "DO",
    headline: "建议 DO：与当前项目接口演进直接相关。",
    reasons: ["来源可信，含官方变更日志", "可验证，给出参数与兼容提示", "信息密度高，适合立即学习"],
    snippets: ["“新增 reasoning_effort 字段用于控制推理预算。”", "“建议先在非关键路径验证配置变化。”"],
    nextActionHint: "进入学习会话，用问题卡确认迁移边界。"
  },
  {
    id: "signal-beta",
    title: "Next.js 小版本发布",
    publishedAt: "09:42",
    summary: "摘要：包含构建速度与缓存稳定性调整。",
    triageStatus: "pending",
    recommendation: "UNSET"
  },
  {
    id: "signal-gamma",
    title: "转载：AI 工程周报",
    publishedAt: "10:06",
    summary: "摘要：二次整理，缺少新增数据。",
    triageStatus: "ready",
    recommendation: "FYI",
    headline: "建议 FYI：信息密度一般，无新增事实。",
    reasons: ["转载内容较多", "可验证信息较少", "对当前任务影响有限"],
    snippets: ["“多为已公开观点汇总。”"],
    nextActionHint: "无需展开学习，可直接 FYI 或 DROP。"
  }
];

export const MOCK_STORE_STORAGE_KEY = "fomo_firewall_app_v1";
export const MOCK_STORE_STORAGE_VERSION = 1;

function nowIso(): string {
  return new Date().toISOString();
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDisposition(value: unknown): value is Disposition {
  return value === "UNSET" || value === "FYI" || value === "DO" || value === "DROP";
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/$/, "");
}

function canonicalUrl(value: string): string {
  return normalizeUrl(value).toLowerCase();
}

function sourceLabelFromUrl(value: string): string {
  try {
    const parsed = new URL(value);
    return parsed.hostname.replace(/^www\./, "") || "未命名订阅源";
  } catch {
    return "未命名订阅源";
  }
}

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }

    const tag = entry.trim();
    if (!tag) {
      continue;
    }

    seen.add(tag);
  }

  return [...seen];
}

function initialSettings(): MockSettings {
  return {
    rssSources: [],
    schedule: {
      enabled: false,
      time: "09:00",
      timezone: detectTimezone()
    },
    apiConfig: {
      baseUrl: "",
      apiKey: ""
    }
  };
}

function toLegacySources(settings: MockSettings): SourceItem[] {
  return settings.rssSources.map((source) => ({
    id: source.id,
    name: source.name,
    url: source.url,
    enabled: source.enabled
  }));
}

function buildSignalsFromSettings(settings: MockSettings): SignalItem[] {
  const enabledSources = settings.rssSources.filter((source) => source.enabled);
  const sourcePool =
    enabledSources.length > 0
      ? enabledSources
      : settings.rssSources.length > 0
        ? settings.rssSources
        : DEFAULT_DIGEST_SOURCES;

  return SIGNAL_TEMPLATES.map((template, index) => {
    const source = sourcePool[index % sourcePool.length];

    return {
      ...template,
      source: source.name,
      sourceId: source.id,
      originalUrl: source.url
    };
  });
}

function normalizeSettings(value: unknown, legacySources: SourceItem[]): MockSettings {
  const defaults = initialSettings();
  const candidate = isRecord(value) ? value : {};

  const rawRssSources = Array.isArray(candidate.rssSources) ? candidate.rssSources : legacySources;
  const rssSources: RssSourceSetting[] = rawRssSources
    .map((entry, index) => {
      if (!isRecord(entry)) {
        return null;
      }

      const rawUrl = typeof entry.url === "string" ? normalizeUrl(entry.url) : "";
      if (!rawUrl || !isValidHttpUrl(rawUrl)) {
        return null;
      }

      const id = typeof entry.id === "string" && entry.id ? entry.id : `rss-${index + 1}`;
      const name =
        typeof entry.name === "string" && entry.name.trim().length > 0
          ? entry.name.trim()
          : sourceLabelFromUrl(rawUrl);
      const enabled = typeof entry.enabled === "boolean" ? entry.enabled : true;
      const createdAt = typeof entry.createdAt === "string" ? entry.createdAt : nowIso();
      const tags = parseTags(entry.tags);

      return {
        id,
        name,
        url: rawUrl,
        tags,
        enabled,
        createdAt
      };
    })
    .filter((entry): entry is RssSourceSetting => Boolean(entry));

  const scheduleCandidate = isRecord(candidate.schedule) ? candidate.schedule : {};
  const schedule: DigestScheduleSetting = {
    enabled:
      typeof scheduleCandidate.enabled === "boolean"
        ? scheduleCandidate.enabled
        : defaults.schedule.enabled,
    time:
      typeof scheduleCandidate.time === "string" && /^\d{2}:\d{2}$/.test(scheduleCandidate.time)
        ? scheduleCandidate.time
        : defaults.schedule.time,
    timezone:
      typeof scheduleCandidate.timezone === "string" && scheduleCandidate.timezone
        ? scheduleCandidate.timezone
        : defaults.schedule.timezone
  };

  const apiCandidate = isRecord(candidate.apiConfig) ? candidate.apiConfig : {};
  const apiConfig: ApiConfigSetting = {
    baseUrl: typeof apiCandidate.baseUrl === "string" ? apiCandidate.baseUrl.trim() : "",
    apiKey: typeof apiCandidate.apiKey === "string" ? apiCandidate.apiKey : ""
  };

  return {
    rssSources,
    schedule,
    apiConfig
  };
}

function syncDispositionsForSignals(
  currentDispositions: Record<string, Disposition>,
  signals: SignalItem[]
): Record<string, Disposition> {
  return signals.reduce<Record<string, Disposition>>((acc, signal) => {
    acc[signal.id] = currentDispositions[signal.id] ?? "UNSET";
    return acc;
  }, {});
}

function applySettingsToState(current: MockState, settings: MockSettings): MockState {
  const signals = buildSignalsFromSettings(settings);

  return {
    ...current,
    settings,
    sources: toLegacySources(settings),
    signals,
    dispositions: syncDispositionsForSignals(current.dispositions, signals)
  };
}

function toMockState(value: unknown): MockState | null {
  const candidate = isRecord(value) && isRecord(value.state) ? value.state : value;
  if (!isRecord(candidate)) {
    return null;
  }

  const sources = Array.isArray(candidate.sources) ? (candidate.sources as SourceItem[]) : [];
  const dispositions = isRecord(candidate.dispositions)
    ? (candidate.dispositions as Record<string, unknown>)
    : null;
  const sessions = Array.isArray(candidate.sessions) ? (candidate.sessions as SessionItem[]) : null;
  const sessionMessages = Array.isArray(candidate.sessionMessages)
    ? (candidate.sessionMessages as SessionMessage[])
    : null;
  const jobs = Array.isArray(candidate.jobs) ? (candidate.jobs as JobItem[]) : null;
  const memoryCards = Array.isArray(candidate.memoryCards) ? (candidate.memoryCards as MemoryCard[]) : null;
  const evidencePacks = Array.isArray(candidate.evidencePacks)
    ? (candidate.evidencePacks as EvidencePack[])
    : null;

  if (!dispositions || !sessions || !sessionMessages || !jobs || !memoryCards || !evidencePacks) {
    return null;
  }

  const sanitizedDispositions: Record<string, Disposition> = {};
  for (const [signalId, disposition] of Object.entries(dispositions)) {
    if (isDisposition(disposition)) {
      sanitizedDispositions[signalId] = disposition;
    }
  }

  const settings = normalizeSettings(candidate.settings, sources);

  const baseState: MockState = {
    settings,
    sources: toLegacySources(settings),
    signals: buildSignalsFromSettings(settings),
    dispositions: sanitizedDispositions,
    sessions,
    sessionMessages,
    jobs,
    memoryCards,
    evidencePacks
  };

  return applySettingsToState(baseState, settings);
}

function updateSequenceFromState(value: MockState): void {
  const ids = [
    ...value.sessionMessages.map((item) => item.id),
    ...value.jobs.map((item) => item.id),
    ...value.settings.rssSources.map((item) => item.id)
  ];

  const maxSeen = ids.reduce((max, id) => {
    const matched = /-(\d+)$/.exec(id);
    if (!matched) {
      return max;
    }

    const parsed = Number.parseInt(matched[1], 10);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);

  sequence = Math.max(sequence, maxSeen);
}

export function jobStatusLabel(status: JobStatusView): string {
  if (status === "queued") return "排队中";
  if (status === "running") return "生成中";
  if (status === "done") return "已完成";
  if (status === "failed") return "失败";
  return "未开始";
}

export function readPersistedMockState(): PersistedState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(MOCK_STORE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (isRecord(parsed) && "version" in parsed) {
      const version = parsed.version;
      if (typeof version !== "number" || version !== MOCK_STORE_STORAGE_VERSION) {
        return null;
      }
    }

    const restored = toMockState(parsed);
    if (!restored) {
      return null;
    }

    return {
      version: MOCK_STORE_STORAGE_VERSION,
      state: restored
    };
  } catch {
    return null;
  }
}

export function writePersistedMockState(value: MockState): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload: PersistedState = {
    version: MOCK_STORE_STORAGE_VERSION,
    state: value
  };

  try {
    window.localStorage.setItem(MOCK_STORE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore persistence errors to keep the prototype interactive.
  }
}

export function removePersistedMockState(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(MOCK_STORE_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function initialState(): MockState {
  const settings = initialSettings();
  const signals = buildSignalsFromSettings(settings);

  return {
    settings,
    sources: toLegacySources(settings),
    signals,
    dispositions: signals.reduce<Record<string, Disposition>>((acc, signal) => {
      acc[signal.id] = "UNSET";
      return acc;
    }, {}),
    sessions: [],
    sessionMessages: [],
    jobs: [],
    memoryCards: [],
    evidencePacks: []
  };
}

let state: MockState = initialState();
const listeners = new Set<() => void>();
let skipPersistOnce = false;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(updater: (current: MockState) => MockState): void {
  state = updater(state);
  // Persist synchronously to avoid route-change races in e2e/user flows.
  writePersistedMockState(state);
  writePersistedSettings(state.settings);
  emit();
}

export function subscribeMockStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function consumePersistSkipSignal(): boolean {
  if (!skipPersistOnce) {
    return false;
  }

  skipPersistOnce = false;
  return true;
}

export function getMockState(): MockState {
  return state;
}

export function useMockStore<T>(selector: (current: MockState) => T): T {
  return useSyncExternalStore(
    subscribeMockStore,
    () => selector(state),
    () => selector(state)
  );
}

function findSessionBySignal(current: MockState, signalId: string): SessionItem | undefined {
  return current.sessions.find((session) => session.signalId === signalId);
}

function ensureSessionInternal(current: MockState, signalId: string): { nextState: MockState; session: SessionItem } {
  const existing = findSessionBySignal(current, signalId);
  if (existing) {
    return { nextState: current, session: existing };
  }

  const createdAt = nowIso();
  const session: SessionItem = {
    id: `session-${signalId}`,
    signalId,
    status: "paused",
    createdAt,
    updatedAt: createdAt
  };

  return {
    nextState: {
      ...current,
      sessions: [...current.sessions, session]
    },
    session
  };
}

function updateSessionStatus(current: MockState, sessionId: string, status: SessionStatus): MockState {
  const updatedAt = nowIso();
  return {
    ...current,
    sessions: current.sessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            status,
            updatedAt
          }
        : session
    )
  };
}

function addMessage(current: MockState, sessionId: string, role: SessionMessage["role"], content: string): MockState {
  const createdAt = nowIso();
  const message: SessionMessage = {
    id: nextId("msg"),
    sessionId,
    role,
    content,
    createdAt
  };

  return {
    ...updateSessionStatus(current, sessionId, "active"),
    sessionMessages: [...current.sessionMessages, message]
  };
}

function upsertJob(
  current: MockState,
  jobId: string,
  status: JobStatus,
  resultId?: string
): MockState {
  const updatedAt = nowIso();
  return {
    ...current,
    jobs: current.jobs.map((job) =>
      job.id === jobId
        ? {
            ...job,
            status,
            updatedAt,
            resultId: resultId ?? job.resultId
          }
        : job
    )
  };
}

function generateEvidencePack(current: MockState, sessionId: string): { nextState: MockState; evidenceId: string } {
  const session = current.sessions.find((item) => item.id === sessionId);
  if (!session) {
    return { nextState: current, evidenceId: "" };
  }

  const signal = current.signals.find((item) => item.id === session.signalId);
  const messages = current.sessionMessages.filter((item) => item.sessionId === sessionId);
  const evidenceId = `evidence-${sessionId}`;
  const summarySeed = messages.slice(-2).map((item) => item.content).join(" ");

  const pack: EvidencePack = {
    id: evidenceId,
    sessionId,
    signalId: session.signalId,
    summary:
      summarySeed ||
      "该证据包来自学习会话摘要，建议先看关键引用，再决定是否继续对话。",
    quotes: messages.slice(0, 3).map((item) => item.content).filter(Boolean),
    links: [signal?.originalUrl ?? "https://example.com/source", "https://example.com/reference"],
    createdAt: nowIso()
  };

  const others = current.evidencePacks.filter((item) => item.id !== evidenceId);

  return {
    nextState: {
      ...current,
      evidencePacks: [...others, pack]
    },
    evidenceId
  };
}

function generateFlashcards(current: MockState, sessionId: string): { nextState: MockState; cardIds: string[] } {
  const session = current.sessions.find((item) => item.id === sessionId);
  if (!session) {
    return { nextState: current, cardIds: [] };
  }

  const signal = current.signals.find((item) => item.id === session.signalId);
  const evidenceId = current.evidencePacks.find((item) => item.sessionId === sessionId)?.id;
  const baseCards: Array<{ question: string; answer: string }> = [
    {
      question: "这条线索为什么值得进入学习会话？",
      answer: "它包含可验证变更与明确的执行建议，适合快速转行动。"
    },
    {
      question: "最小验证步骤应该是什么？",
      answer: "先在低风险路径做实验，再比较关键指标并设置回滚阈值。"
    },
    {
      question: "什么时候应当选择稍后看而不是去学习？",
      answer: "当信息密度低、无新增事实或与当前目标弱相关时。"
    }
  ];

  const createdAt = nowIso();
  const generatedCards = baseCards.map((entry, index) => ({
    id: `card-${sessionId}-${index + 1}`,
    sessionId,
    signalId: session.signalId,
    question: entry.question,
    answer: entry.answer,
    source: signal?.source ?? "Unknown",
    evidenceId,
    createdAt
  }));

  const others = current.memoryCards.filter((item) => item.sessionId !== sessionId);

  return {
    nextState: {
      ...current,
      memoryCards: [...others, ...generatedCards]
    },
    cardIds: generatedCards.map((item) => item.id)
  };
}

export const mockActions = {
  reset(): void {
    state = initialState();
    updateSequenceFromState(state);
    emit();
  },

  hydrateFromStorage(payload: unknown): void {
    if (isRecord(payload) && "version" in payload) {
      const version = payload.version;
      if (typeof version !== "number" || version !== MOCK_STORE_STORAGE_VERSION) {
        state = initialState();
        updateSequenceFromState(state);
        emit();
        return;
      }
    }

    const restored = toMockState(payload);
    if (!restored) {
      state = initialState();
      updateSequenceFromState(state);
      emit();
      return;
    }

    state = restored;
    updateSequenceFromState(state);
    emit();
  },

  hydrateSettings(settingsPayload: unknown): void {
    const settings = normalizeSettings(settingsPayload, state.sources);
    state = applySettingsToState(state, settings);
    updateSequenceFromState(state);
    emit();
  },

  clearPersistedState(): void {
    removePersistedMockState();
    clearPersistedSettings();
    skipPersistOnce = true;
    state = initialState();
    updateSequenceFromState(state);
    emit();
  },

  setDisposition(signalId: string, disposition: Disposition): void {
    setState((current) => {
      const nextDisposition = {
        ...current.dispositions,
        [signalId]: disposition
      };

      let nextState: MockState = {
        ...current,
        dispositions: nextDisposition
      };

      if (disposition === "DO") {
        const ensured = ensureSessionInternal(nextState, signalId);
        nextState = ensured.nextState;
      }

      return nextState;
    });
  },

  getOrCreateSessionForSignal(signalId: string): string {
    const ensured = ensureSessionInternal(state, signalId);
    if (ensured.nextState !== state) {
      state = ensured.nextState;
      emit();
    }

    return ensured.session.id;
  },

  getLatestSessionId(): string | null {
    if (state.sessions.length === 0) {
      return null;
    }

    const latest = [...state.sessions].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];

    return latest?.id ?? null;
  },

  enterSession(sessionId: string): void {
    setState((current) => updateSessionStatus(current, sessionId, "active"));
  },

  pauseSession(sessionId: string): void {
    setState((current) => updateSessionStatus(current, sessionId, "paused"));
  },

  sendUserMessage(sessionId: string, text: string): void {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    setState((current) => addMessage(current, sessionId, "user", trimmed));

    setTimeout(() => {
      setState((current) => {
        const latestSession = current.sessions.find((item) => item.id === sessionId);
        if (!latestSession) {
          return current;
        }

        const reply = "已收到，你可以继续提问，或点击后台生成闪卡/证据包。";
        return addMessage(current, sessionId, "assistant", reply);
      });
    }, 320);
  },

  startJob(sessionId: string, kind: JobKind): string {
    const jobId = nextId(`job-${kind}`);
    const createdAt = nowIso();

    setState((current) => ({
      ...current,
      jobs: [
        ...current.jobs,
        {
          id: jobId,
          sessionId,
          kind,
          status: "queued",
          createdAt,
          updatedAt: createdAt
        }
      ]
    }));

    setTimeout(() => {
      setState((current) => upsertJob(current, jobId, "running"));
    }, 350);

    setTimeout(() => {
      setState((current) => {
        if (kind === "flashcards") {
          const withEvidence = current.evidencePacks.some((item) => item.sessionId === sessionId)
            ? current
            : generateEvidencePack(current, sessionId).nextState;
          const generated = generateFlashcards(withEvidence, sessionId);
          return upsertJob(generated.nextState, jobId, "done", generated.cardIds[0]);
        }

        const generated = generateEvidencePack(current, sessionId);
        return upsertJob(generated.nextState, jobId, "done", generated.evidenceId);
      });
    }, 1450);

    return jobId;
  },

  addRssSource(input: AddRssSourceInput): AddRssSourceResult {
    const normalized = normalizeUrl(input.url);
    if (!isValidHttpUrl(normalized)) {
      return {
        ok: false,
        reason: "invalid_url"
      };
    }

    const normalizedKey = canonicalUrl(normalized);
    const existing = state.settings.rssSources.find((item) => canonicalUrl(item.url) === normalizedKey);
    if (existing) {
      return {
        ok: false,
        reason: "duplicate",
        existingId: existing.id
      };
    }

    const name = input.name?.trim() ? input.name.trim() : sourceLabelFromUrl(normalized);
    const tags = parseTags(input.tags ?? []);

    const created: RssSourceSetting = {
      id: nextId("rss"),
      name,
      url: normalized,
      tags,
      enabled: true,
      createdAt: nowIso()
    };

    setState((current) => {
      const settings: MockSettings = {
        ...current.settings,
        rssSources: [...current.settings.rssSources, created]
      };

      return applySettingsToState(current, settings);
    });

    return { ok: true };
  },

  setRssSourceEnabled(sourceId: string, enabled: boolean): void {
    setState((current) => {
      const settings: MockSettings = {
        ...current.settings,
        rssSources: current.settings.rssSources.map((item) =>
          item.id === sourceId
            ? {
                ...item,
                enabled
              }
            : item
        )
      };

      return applySettingsToState(current, settings);
    });
  },

  removeRssSource(sourceId: string): void {
    setState((current) => {
      const settings: MockSettings = {
        ...current.settings,
        rssSources: current.settings.rssSources.filter((item) => item.id !== sourceId)
      };

      return applySettingsToState(current, settings);
    });
  },

  updateDigestSchedule(input: Partial<Pick<DigestScheduleSetting, "enabled" | "time">>): void {
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        schedule: {
          ...current.settings.schedule,
          enabled:
            typeof input.enabled === "boolean"
              ? input.enabled
              : current.settings.schedule.enabled,
          time:
            typeof input.time === "string" && /^\d{2}:\d{2}$/.test(input.time)
              ? input.time
              : current.settings.schedule.time
        }
      }
    }));
  },

  saveApiConfig(input: SaveApiConfigInput): SaveApiConfigResult {
    const baseUrl = normalizeUrl(input.baseUrl);
    if (!isValidHttpUrl(baseUrl)) {
      return {
        ok: false,
        reason: "invalid_url"
      };
    }

    const apiKey = input.apiKey.trim();
    if (!apiKey) {
      return {
        ok: false,
        reason: "empty_key"
      };
    }

    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        apiConfig: {
          baseUrl,
          apiKey
        }
      }
    }));

    return { ok: true };
  },

  toggleSource(sourceId: string): void {
    const existing = state.settings.rssSources.find((item) => item.id === sourceId);
    if (!existing) {
      return;
    }

    mockActions.setRssSourceEnabled(sourceId, !existing.enabled);
  },

  removeSource(sourceId: string): void {
    mockActions.removeRssSource(sourceId);
  }
};

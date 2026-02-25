"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ConfirmModal } from "@/components/confirm-modal";
import { DigestDrawer } from "@/components/digest-drawer";
import styles from "@/app/demo-ui.module.css";
import {
  AppApiError,
  createOrResumeSession,
  enterSessionFromSignal,
  fetchAppSettings,
  fetchDigest,
  fetchDigestStatus,
  fetchProfile,
  fetchSignalPreview,
  generateSignalTriage,
  manualRefreshDigest,
  setSignalDisposition,
  trackSignalEvent
} from "@/lib/client/app-api";
import type {
  DigestCountsView,
  DigestLastRefreshView,
  DigestSignal,
  DigestStatusView,
  DigestViewResponse,
  DigestWindowDays,
  DispositionLabel,
  RoleV2,
  SignalPreviewView,
  TriageCardView
} from "@/lib/client/app-types";
import {
  buildDigestResetConfirmMessage,
  formatDigestPublishedAt,
  formatDispositionLabel,
  formatSuggestionLabel
} from "@/lib/client/digest-view";
import { formatLlmWarningHint } from "@/lib/client/llm-warning-hints";
import { paginateItems } from "@/lib/client/pagination";
import { parseTriageCardView } from "@/lib/client/triage-card-view";
import { pickAiSummaryText } from "@/lib/shared/ai-summary";
import { getDateKeyInTimeZone, isValidTimeZone } from "@/lib/time/date-window";

type DigestTab = "pending" | "do" | "later" | "drop";
type DispositionView = DispositionLabel | "UNSET";

interface DigestViewState {
  tab: DigestTab;
  windowDays: DigestWindowDays;
  page: number;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

interface DigestRefreshMarker {
  dateKey: string;
  windowDays: DigestWindowDays;
  baselineGeneratedAt: string | null;
  startedAtMs: number;
}

interface RefreshProgressView {
  message: string;
  elapsedBaseSeconds: number;
  recovering: boolean;
}

const DIGEST_PAGE_SIZE = 10;
const DIGEST_STATE_STORAGE_KEY = "fomo.digest.view-state";
const DIGEST_REFRESH_MARKER_KEY = "fomo.digest.refresh-marker";
const DIGEST_REFRESH_STATUS_POLL_MS = 1500;
const DIGEST_REFRESH_MARKER_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_VIEW_STATE: DigestViewState = {
  tab: "pending",
  windowDays: 1,
  page: 1
};
const DIGEST_WINDOW_OPTIONS: Array<{ value: DigestWindowDays; label: string }> = [
  { value: 1, label: "当天" },
  { value: 3, label: "近3天" },
  { value: 7, label: "近7天" }
];
const DIGEST_REFRESH_LIMIT = 100;
const EMPTY_COUNTS: DigestCountsView = {
  total: 0,
  pending: 0,
  processed: 0,
  later: 0,
  do: 0,
  drop: 0
};

function label(value: DispositionView): string {
  return formatDispositionLabel(value);
}

function toDateKey(date: Date, timezone: string): string {
  try {
    return getDateKeyInTimeZone(date, timezone);
  } catch {
    return getDateKeyInTimeZone(date, "UTC");
  }
}

function detectBrowserTimezone(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(timezone) ? timezone : "UTC";
  } catch {
    return "UTC";
  }
}

function sourceName(signal: DigestSignal): string {
  return signal.source.name ?? "未命名来源";
}

function formatWindowLabel(value: DigestWindowDays): string {
  if (value === 1) return "当天";
  if (value === 3) return "近3天";
  return "近7天";
}

function normalizeTab(value: string | null): DigestTab {
  if (value === "pending" || value === "do" || value === "later" || value === "drop") {
    return value;
  }
  return DEFAULT_VIEW_STATE.tab;
}

function normalizeWindowDays(value: string | null): DigestWindowDays {
  if (value === "1" || value === "3" || value === "7") {
    return Number(value) as DigestWindowDays;
  }
  return DEFAULT_VIEW_STATE.windowDays;
}

function normalizePage(value: string | null): number {
  if (!value) return DEFAULT_VIEW_STATE.page;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_VIEW_STATE.page;
  }
  return parsed;
}

function parseDigestViewStateFromSearch(searchParams: URLSearchParams): DigestViewState {
  return {
    tab: normalizeTab(searchParams.get("tab")),
    windowDays: normalizeWindowDays(searchParams.get("window")),
    page: normalizePage(searchParams.get("page"))
  };
}

function readStoredDigestViewState(): DigestViewState | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(DIGEST_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as {
      tab?: unknown;
      windowDays?: unknown;
      page?: unknown;
    };
    return {
      tab: normalizeTab(typeof parsed.tab === "string" ? parsed.tab : null),
      windowDays: normalizeWindowDays(
        parsed.windowDays === 1 || parsed.windowDays === 3 || parsed.windowDays === 7
          ? String(parsed.windowDays)
          : null
      ),
      page:
        typeof parsed.page === "number" && Number.isFinite(parsed.page) && parsed.page > 0
          ? Math.floor(parsed.page)
          : 1
    };
  } catch {
    return null;
  }
}

function isSameViewState(a: DigestViewState, b: DigestViewState): boolean {
  return a.tab === b.tab && a.windowDays === b.windowDays && a.page === b.page;
}

function makeSearchParams(state: DigestViewState): URLSearchParams {
  const search = new URLSearchParams();
  search.set("tab", state.tab);
  search.set("window", String(state.windowDays));
  search.set("page", String(state.page));
  return search;
}

function writeDigestRefreshMarker(marker: DigestRefreshMarker): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(DIGEST_REFRESH_MARKER_KEY, JSON.stringify(marker));
}

function readDigestRefreshMarker(): DigestRefreshMarker | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(DIGEST_REFRESH_MARKER_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as {
      dateKey?: unknown;
      windowDays?: unknown;
      baselineGeneratedAt?: unknown;
      startedAtMs?: unknown;
    };
    const windowDays = normalizeWindowDays(
      parsed.windowDays === 1 || parsed.windowDays === 3 || parsed.windowDays === 7
        ? String(parsed.windowDays)
        : null
    );
    const startedAtMs =
      typeof parsed.startedAtMs === "number" && Number.isFinite(parsed.startedAtMs)
        ? parsed.startedAtMs
        : Number.NaN;
    if (typeof parsed.dateKey !== "string" || !parsed.dateKey || !Number.isFinite(startedAtMs)) {
      return null;
    }
    return {
      dateKey: parsed.dateKey,
      windowDays,
      baselineGeneratedAt: typeof parsed.baselineGeneratedAt === "string" ? parsed.baselineGeneratedAt : null,
      startedAtMs
    };
  } catch {
    return null;
  }
}

function clearDigestRefreshMarker(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(DIGEST_REFRESH_MARKER_KEY);
}

function isDigestRefreshCompleted(
  status: DigestStatusView,
  marker: Pick<DigestRefreshMarker, "baselineGeneratedAt">
): boolean {
  if (!status.hasDigest || !status.generatedAt) {
    return false;
  }
  if (!marker.baselineGeneratedAt) {
    return true;
  }
  return status.generatedAt !== marker.baselineGeneratedAt;
}

function estimateRefreshPercent(elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) {
    return 5;
  }
  if (elapsedSeconds >= 90) {
    return 95;
  }
  const progress = Math.round(5 + (elapsedSeconds / 90) * 90);
  return Math.max(5, Math.min(95, progress));
}

function DigestPageFallback() {
  return (
    <AppShell
      active="digest"
      title="日报处置"
      subtitle="先手动生成日报，再对线索做决策：稍后看 / 去学习 / 忽略。"
    >
      <section className={styles.ruleHint}>加载日报中...</section>
    </AppShell>
  );
}

function AppDigestPageBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initializedViewStateRef = useRef(false);
  const pendingInitialViewStateRef = useRef<DigestViewState | null>(null);
  const hasLoadedInitialDigestRef = useRef(false);
  const loadedDigestTimezoneRef = useRef<string | null>(null);
  const summaryHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRecoveryRef = useRef(false);
  const confirmResolverRef = useRef<((result: boolean) => void) | null>(null);
  const [signals, setSignals] = useState<DigestSignal[]>([]);
  const [dispositions, setDispositions] = useState<Record<string, DispositionView>>({});
  const [triageBySignal, setTriageBySignal] = useState<Record<string, TriageCardView | null>>({});
  const [previewBySignal, setPreviewBySignal] = useState<Record<string, SignalPreviewView | null>>({});
  const [previewLoadingBySignal, setPreviewLoadingBySignal] = useState<Record<string, boolean>>({});
  const [previewErrorBySignal, setPreviewErrorBySignal] = useState<Record<string, string | null>>({});
  const [sessionHintBySignal, setSessionHintBySignal] = useState<Record<string, boolean>>({});
  const [triageBusyBySignal, setTriageBusyBySignal] = useState<Record<string, boolean>>({});
  const [viewState, setViewState] = useState<DigestViewState>(DEFAULT_VIEW_STATE);
  const [activeWindowDays, setActiveWindowDays] = useState<DigestWindowDays>(DEFAULT_VIEW_STATE.windowDays);
  const [triageRole, setTriageRole] = useState<RoleV2>("ENG");
  const [digestTimezone, setDigestTimezone] = useState("UTC");
  const [drawerSignalId, setDrawerSignalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busySignalId, setBusySignalId] = useState<string | null>(null);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [legacyNotice, setLegacyNotice] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<DigestLastRefreshView | null>(null);
  const [counts, setCounts] = useState<DigestCountsView>(EMPTY_COUNTS);
  const [refreshSummaryVisible, setRefreshSummaryVisible] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [refreshProgress, setRefreshProgress] = useState<RefreshProgressView | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refreshElapsedSeconds = refreshProgress
    ? Math.max(0, refreshProgress.elapsedBaseSeconds + refreshTick)
    : 0;
  const refreshPercent = refreshProgress ? estimateRefreshPercent(refreshElapsedSeconds) : 0;

  const replaceUrlState = useCallback(
    (next: DigestViewState) => {
      const search = makeSearchParams(next);
      router.replace(`/app/digest?${search.toString()}`, { scroll: false });
    },
    [router]
  );

  const updateViewState = useCallback(
    (patch: Partial<DigestViewState>) => {
      setViewState((current) => {
        const next: DigestViewState = {
          tab: patch.tab ?? current.tab,
          windowDays: patch.windowDays ?? current.windowDays,
          page: patch.page ?? current.page
        };
        next.page = Math.max(1, next.page);
        if (isSameViewState(current, next)) {
          return current;
        }
        return next;
      });
    },
    []
  );

  const closeConfirmDialog = useCallback((result: boolean) => {
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setConfirmDialog(null);
    resolver?.(result);
  }, []);

  const openConfirmDialog = useCallback(
    (input: ConfirmDialogState): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        confirmResolverRef.current = resolve;
        setConfirmDialog(input);
      });
    },
    []
  );

  function applyDigestViewPayload(payload: DigestViewResponse): void {
    setHasSnapshot(payload.hasSnapshot);
    setGeneratedAt(payload.generatedAt);
    setLegacyNotice(payload.legacyNotice);
    setLastRefresh(payload.lastRefresh);
    setCounts(payload.counts);
    setSignals(payload.digest.signals);

    const parsedTriageBySignal = payload.digest.signals.reduce<Record<string, TriageCardView | null>>(
      (acc, signal) => {
        acc[signal.id] = parseTriageCardView(signal.triage);
        return acc;
      },
      {}
    );
    setTriageBySignal(parsedTriageBySignal);
    setDispositions(
      payload.digest.signals.reduce<Record<string, DispositionView>>((acc, signal) => {
        acc[signal.id] = signal.disposition ?? "UNSET";
        return acc;
      }, {})
    );
  }

  async function ensureTriage(signalId: string, role: RoleV2 = triageRole): Promise<void> {
    if (triageBusyBySignal[signalId]) {
      return;
    }
    setTriageBusyBySignal((current) => ({ ...current, [signalId]: true }));
    try {
      const triage = await generateSignalTriage(signalId, role);
      setTriageBySignal((current) => ({
        ...current,
        [signalId]: triage
      }));
    } catch (triageError) {
      if (triageError instanceof AppApiError) {
        setError(`${triageError.code}: ${triageError.message}`);
      } else {
        setError("TRIAGE_GENERATE_FAILED");
      }
    } finally {
      setTriageBusyBySignal((current) => ({ ...current, [signalId]: false }));
    }
  }

  const ensureSignalPreview = useCallback(
    async (signalId: string): Promise<void> => {
      if (previewBySignal[signalId] || previewLoadingBySignal[signalId]) {
        return;
      }
      setPreviewLoadingBySignal((current) => ({ ...current, [signalId]: true }));
      setPreviewErrorBySignal((current) => ({ ...current, [signalId]: null }));
      try {
        const preview = await fetchSignalPreview(signalId);
        setPreviewBySignal((current) => ({
          ...current,
          [signalId]: preview
        }));
      } catch (previewError) {
        if (previewError instanceof AppApiError) {
          setPreviewErrorBySignal((current) => ({
            ...current,
            [signalId]: `${previewError.code}: ${previewError.message}`
          }));
        } else {
          setPreviewErrorBySignal((current) => ({
            ...current,
            [signalId]: "SIGNAL_PREVIEW_LOAD_FAILED"
          }));
        }
      } finally {
        setPreviewLoadingBySignal((current) => ({ ...current, [signalId]: false }));
      }
    },
    [previewBySignal, previewLoadingBySignal]
  );

  async function loadDigest(selectedWindowDays: DigestWindowDays = viewState.windowDays): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchDigest(toDateKey(new Date(), digestTimezone), selectedWindowDays);
      setActiveWindowDays(selectedWindowDays);
      applyDigestViewPayload(payload);
    } catch (fetchError) {
      if (fetchError instanceof AppApiError) {
        setError(`${fetchError.code}: ${fetchError.message}`);
      } else {
        setError("DIGEST_LOAD_FAILED");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const hasQuery =
      searchParams.has("tab") || searchParams.has("window") || searchParams.has("page");
    if (!hasQuery && initializedViewStateRef.current) {
      return;
    }
    let next = hasQuery ? parseDigestViewStateFromSearch(searchParams) : DEFAULT_VIEW_STATE;
    if (!initializedViewStateRef.current && !hasQuery) {
      const stored = readStoredDigestViewState();
      if (stored) {
        next = stored;
      }
    }
    if (!initializedViewStateRef.current) {
      pendingInitialViewStateRef.current = next;
    }
    initializedViewStateRef.current = true;
    setViewState((current) => (isSameViewState(current, next) ? current : next));
  }, [searchParams]);

  useEffect(() => {
    if (!initializedViewStateRef.current) {
      return;
    }
    const pending = pendingInitialViewStateRef.current;
    if (pending && !isSameViewState(viewState, pending)) {
      return;
    }
    const currentUrlState = parseDigestViewStateFromSearch(searchParams);
    if (isSameViewState(currentUrlState, viewState)) {
      return;
    }
    replaceUrlState(viewState);
  }, [replaceUrlState, searchParams, viewState]);

  useEffect(() => {
    if (!initializedViewStateRef.current) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const pending = pendingInitialViewStateRef.current;
    if (pending && !isSameViewState(viewState, pending)) {
      return;
    }
    if (pending && isSameViewState(viewState, pending)) {
      pendingInitialViewStateRef.current = null;
    }
    window.sessionStorage.setItem(DIGEST_STATE_STORAGE_KEY, JSON.stringify(viewState));
  }, [viewState]);

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      let role: RoleV2 = "ENG";
      let timezone = detectBrowserTimezone();
      try {
        const [profile, settings] = await Promise.all([fetchProfile(), fetchAppSettings()]);
        role = profile.role;
        const savedTimezone = settings.schedule.timezone || "UTC";
        if (savedTimezone !== "UTC" && isValidTimeZone(savedTimezone)) {
          timezone = savedTimezone;
        }
      } catch {
        role = "ENG";
        timezone = detectBrowserTimezone();
      }
      setTriageRole(role);
      setDigestTimezone(timezone);
      setBootstrapped(true);
    }

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!bootstrapped || !initializedViewStateRef.current) {
      return;
    }
    const pending = pendingInitialViewStateRef.current;
    if (pending && !isSameViewState(viewState, pending)) {
      return;
    }
    const timezoneChanged =
      loadedDigestTimezoneRef.current !== null && loadedDigestTimezoneRef.current !== digestTimezone;
    if (!hasLoadedInitialDigestRef.current || timezoneChanged) {
      hasLoadedInitialDigestRef.current = true;
      loadedDigestTimezoneRef.current = digestTimezone;
      void loadDigest(viewState.windowDays);
    }
  }, [bootstrapped, viewState.windowDays, digestTimezone]);

  useEffect(() => {
    if (!generatedAt && !lastRefresh) {
      return;
    }
    setRefreshSummaryVisible(true);
    if (summaryHideTimerRef.current) {
      clearTimeout(summaryHideTimerRef.current);
    }
    summaryHideTimerRef.current = setTimeout(() => {
      setRefreshSummaryVisible(false);
      summaryHideTimerRef.current = null;
    }, 8000);
  }, [generatedAt, lastRefresh]);

  useEffect(() => {
    return () => {
      if (summaryHideTimerRef.current) {
        clearTimeout(summaryHideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (confirmResolverRef.current) {
        confirmResolverRef.current(false);
        confirmResolverRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!refreshProgress) {
      setRefreshTick(0);
      return;
    }
    setRefreshTick(0);
    const timer = setInterval(() => {
      setRefreshTick((current) => current + 1);
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [refreshProgress]);

  useEffect(() => {
    if (!bootstrapped || refreshRecoveryRef.current || refreshing) {
      return;
    }
    const marker = readDigestRefreshMarker();
    if (!marker) {
      return;
    }
    refreshRecoveryRef.current = true;
    let cancelled = false;

    const recover = async (): Promise<void> => {
      const markerAgeMs = Date.now() - marker.startedAtMs;
      if (markerAgeMs > DIGEST_REFRESH_MARKER_TIMEOUT_MS) {
        clearDigestRefreshMarker();
        refreshRecoveryRef.current = false;
        return;
      }

      setRefreshing(true);
      setRefreshProgress({
        message: `检测到更新任务仍在执行（${formatWindowLabel(marker.windowDays)}），任务会在后台继续。`,
        elapsedBaseSeconds: Math.max(0, Math.floor(markerAgeMs / 1000)),
        recovering: true
      });

      try {
        while (!cancelled) {
          const status = await fetchDigestStatus(marker.dateKey, marker.windowDays);
          if (isDigestRefreshCompleted(status, marker)) {
            setRefreshProgress((current) =>
              current
                ? {
                    ...current,
                    message: "更新完成，正在刷新日报列表..."
                  }
                : current
            );
            await loadDigest(marker.windowDays);
            updateViewState({
              tab: "pending",
              page: 1,
              windowDays: marker.windowDays
            });
            clearDigestRefreshMarker();
            setRefreshProgress(null);
            return;
          }
          if (Date.now() - marker.startedAtMs > DIGEST_REFRESH_MARKER_TIMEOUT_MS) {
            clearDigestRefreshMarker();
            setRefreshProgress(null);
            setError("DIGEST_REFRESH_TIMEOUT: 更新超时，请重新点击“更新日报”。");
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, DIGEST_REFRESH_STATUS_POLL_MS));
        }
      } catch (recoverError) {
        if (!cancelled) {
          setRefreshProgress((current) =>
            current
              ? {
                  ...current,
                  message: "进度同步暂时失败，任务会在后台继续。"
                }
              : current
          );
        }
      } finally {
        if (!cancelled) {
          setRefreshing(false);
        }
        refreshRecoveryRef.current = false;
      }
    };

    void recover();
    return () => {
      cancelled = true;
    };
  }, [bootstrapped, refreshing, updateViewState, viewState.windowDays, digestTimezone]);

  const filteredSignals = useMemo(() => {
    return signals.filter((signal) => {
      const value = dispositions[signal.id] ?? "UNSET";
      if (viewState.tab === "pending") return value === "UNSET";
      if (viewState.tab === "later") return value === "FYI";
      if (viewState.tab === "do") return value === "DO";
      return value === "DROP";
    });
  }, [dispositions, signals, viewState.tab]);
  const pagedSignals = useMemo(
    () => paginateItems(filteredSignals, viewState.page, DIGEST_PAGE_SIZE),
    [viewState.page, filteredSignals]
  );

  useEffect(() => {
    if (viewState.page > pagedSignals.totalPages) {
      updateViewState({
        page: pagedSignals.totalPages
      });
    }
  }, [pagedSignals.totalPages, updateViewState, viewState.page]);

  const drawerSignal = drawerSignalId
    ? signals.find((signal) => signal.id === drawerSignalId) ?? null
    : null;

  useEffect(() => {
    if (!drawerSignalId) {
      return;
    }
    void ensureSignalPreview(drawerSignalId);
  }, [drawerSignalId, ensureSignalPreview]);

  useEffect(() => {
    if (loading || !hasSnapshot) {
      return;
    }

    const pendingSignalIds = pagedSignals.items
      .map((signal) => signal.id)
      .filter(
        (signalId) =>
          !previewBySignal[signalId] &&
          !previewLoadingBySignal[signalId] &&
          !previewErrorBySignal[signalId]
      );

    if (pendingSignalIds.length === 0) {
      return;
    }

    let cancelled = false;
    const queue = [...pendingSignalIds];
    const workerCount = Math.min(3, queue.length);

    const runWorker = async (): Promise<void> => {
      while (!cancelled) {
        const nextSignalId = queue.shift();
        if (!nextSignalId) {
          return;
        }
        await ensureSignalPreview(nextSignalId);
      }
    };

    void Promise.all(Array.from({ length: workerCount }, () => runWorker()));

    return () => {
      cancelled = true;
    };
  }, [
    ensureSignalPreview,
    hasSnapshot,
    loading,
    pagedSignals.items,
    previewBySignal,
    previewErrorBySignal,
    previewLoadingBySignal
  ]);

  async function handleDisposition(signalId: string, value: DispositionLabel): Promise<void> {
    setBusySignalId(signalId);
    setError(null);
    try {
      await setSignalDisposition(signalId, value);
      setDispositions((current) => ({
        ...current,
        [signalId]: value
      }));
      setCounts((current) => {
        const next = { ...current };
        const previous = dispositions[signalId] ?? "UNSET";
        if (previous === value) {
          return current;
        }
        if (previous === "UNSET") {
          next.pending = Math.max(0, next.pending - 1);
          next.processed += 1;
        }
        if (previous === "FYI") next.later = Math.max(0, next.later - 1);
        if (previous === "DO") next.do = Math.max(0, next.do - 1);
        if (previous === "DROP") next.drop = Math.max(0, next.drop - 1);
        if (value === "FYI") next.later += 1;
        if (value === "DO") next.do += 1;
        if (value === "DROP") next.drop += 1;
        return next;
      });
    } catch (setErrorValue) {
      if (setErrorValue instanceof AppApiError) {
        setError(`${setErrorValue.code}: ${setErrorValue.message}`);
      } else {
        setError("DISPOSITION_UPDATE_FAILED");
      }
    } finally {
      setBusySignalId(null);
    }
  }

  async function handleDoAndEnterSession(signalId: string): Promise<void> {
    const confirmed = await openConfirmDialog({
      title: "进入学习会话？",
      message: "将这条线索标记为“去学习”，并马上进入学习会话。",
      confirmLabel: "进入会话",
      cancelLabel: "取消"
    });
    if (!confirmed) {
      return;
    }

    setBusySignalId(signalId);
    setError(null);
    try {
      const result = await enterSessionFromSignal(signalId);
      setDispositions((current) => ({
        ...current,
        [signalId]: result.disposition.label
      }));
      setSessionHintBySignal((current) => ({
        ...current,
        [signalId]: true
      }));
      router.push(`/app/session/${result.session.id}`);
    } catch (sessionError) {
      if (sessionError instanceof AppApiError) {
        setError(`${sessionError.code}: ${sessionError.message}`);
      } else {
        setError("SESSION_ENTER_FAILED");
      }
    } finally {
      setBusySignalId(null);
    }
  }

  async function enterSession(signalId: string): Promise<void> {
    setBusySignalId(signalId);
    setError(null);
    try {
      const session = await createOrResumeSession(signalId);
      setSessionHintBySignal((current) => ({
        ...current,
        [signalId]: true
      }));
      router.push(`/app/session/${session.id}`);
    } catch (sessionError) {
      if (sessionError instanceof AppApiError) {
        setError(`${sessionError.code}: ${sessionError.message}`);
      } else {
        setError("SESSION_ENTER_FAILED");
      }
    } finally {
      setBusySignalId(null);
    }
  }

  async function handleManualRefresh(): Promise<void> {
    const dateKey = toDateKey(new Date(), digestTimezone);
    setRefreshing(true);
    setRefreshProgress({
      message: "正在准备更新日报...",
      elapsedBaseSeconds: 0,
      recovering: false
    });
    setError(null);
    try {
      const status = await fetchDigestStatus(dateKey, viewState.windowDays);
      let overwrite = false;
      let resetMode: "PRESERVE_DISPOSITIONS" | "RESET_DISPOSITIONS" = "PRESERVE_DISPOSITIONS";

      if (status.hasDigest) {
        const shouldOverwrite = await openConfirmDialog({
          title: "覆盖更新日报？",
          message: "当前范围已生成过日报。继续后会覆盖这个范围的快照。",
          confirmLabel: "继续更新",
          cancelLabel: "取消"
        });
        if (!shouldOverwrite) {
          return;
        }
        overwrite = true;
        const shouldReset = await openConfirmDialog({
          title: "是否重置处置状态？",
          message: buildDigestResetConfirmMessage(),
          confirmLabel: "重置并更新",
          cancelLabel: "保留已处置（默认）"
        });
        resetMode = shouldReset ? "RESET_DISPOSITIONS" : "PRESERVE_DISPOSITIONS";
      }

      const marker: DigestRefreshMarker = {
        dateKey,
        windowDays: viewState.windowDays,
        baselineGeneratedAt: status.generatedAt,
        startedAtMs: Date.now()
      };
      writeDigestRefreshMarker(marker);
      setRefreshProgress({
        message: `已开始更新${formatWindowLabel(viewState.windowDays)}日报，任务会在后台继续。`,
        elapsedBaseSeconds: 0,
        recovering: false
      });

      await manualRefreshDigest({
        dateKey,
        overwrite,
        resetMode,
        role: triageRole,
        timezone: digestTimezone,
        windowDays: viewState.windowDays,
        limit: DIGEST_REFRESH_LIMIT,
        keepalive: true
      });
      setRefreshProgress((current) =>
        current
          ? {
              ...current,
              message: "更新完成，正在刷新日报列表..."
            }
          : current
      );
      await loadDigest(viewState.windowDays);
      clearDigestRefreshMarker();
      setRefreshProgress(null);
      updateViewState({
        tab: "pending",
        page: 1
      });
    } catch (refreshError) {
      if (refreshError instanceof AppApiError) {
        clearDigestRefreshMarker();
        setRefreshProgress(null);
        setError(`${refreshError.code}: ${refreshError.message}`);
      } else {
        setError("DIGEST_MANUAL_REFRESH_PENDING: 网络波动，任务会在后台继续。");
        setRefreshProgress((current) =>
          current
            ? {
                ...current,
                recovering: true,
                message: "网络波动，任务会在后台继续。稍后返回日报会自动同步状态。"
              }
            : current
        );
      }
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <AppShell
      active="digest"
      title="日报处置"
      subtitle="先手动生成日报，再对线索做决策：稍后看 / 去学习 / 忽略。"
    >
      <section className={styles.controlBar}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${viewState.tab === "pending" ? styles.tabActive : ""}`}
            onClick={() => updateViewState({ tab: "pending", page: 1 })}
            data-testid="digest-tab-pending"
          >
            待处理 ({counts.pending})
          </button>
          <button
            type="button"
            className={`${styles.tab} ${viewState.tab === "do" ? styles.tabActive : ""}`}
            onClick={() => updateViewState({ tab: "do", page: 1 })}
            data-testid="digest-tab-do"
          >
            去学习 ({counts.do})
          </button>
          <button
            type="button"
            className={`${styles.tab} ${viewState.tab === "later" ? styles.tabActive : ""}`}
            data-testid="digest-tab-later"
            onClick={() => updateViewState({ tab: "later", page: 1 })}
          >
            稍后看 ({counts.later})
          </button>
          <button
            type="button"
            className={`${styles.tab} ${viewState.tab === "drop" ? styles.tabActive : ""}`}
            data-testid="digest-tab-drop"
            onClick={() => updateViewState({ tab: "drop", page: 1 })}
          >
            忽略 ({counts.drop})
          </button>
        </div>

        <section className={styles.inlineActions}>
          <span className={styles.inlineLabel}>日报范围</span>
          {DIGEST_WINDOW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.btnGhost} ${styles.rangeToggle} ${
                viewState.windowDays === option.value ? styles.rangeToggleActive : ""
              }`}
              data-testid={`digest-window-${option.value}d`}
              aria-pressed={viewState.windowDays === option.value}
              onClick={() =>
                updateViewState({
                  windowDays: option.value,
                  page: 1
                })
              }
              disabled={refreshing || loading}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            className={styles.btnPrimary}
            data-testid="digest-manual-refresh"
            disabled={refreshing}
            onClick={() => void handleManualRefresh()}
          >
            {refreshing ? "更新中..." : "更新日报"}
          </button>
        </section>
      </section>

      {refreshProgress ? (
        <section className={styles.ruleHint} data-testid="digest-refresh-progress">
          <p>{refreshProgress.message}</p>
          <p>
            进度约 {refreshPercent}% · 已等待 {refreshElapsedSeconds} 秒 · 任务会在后台继续。
          </p>
        </section>
      ) : null}

      {refreshSummaryVisible ? (
        <section className={styles.ruleHint} data-testid="digest-refresh-summary">
          <div className={styles.summaryHeader}>
            <p>
              {generatedAt
                ? `生成时间 ${formatDigestPublishedAt(generatedAt)} · 当前日报范围 ${formatWindowLabel(
                    activeWindowDays
                  )}`
                : `当前日报范围 ${formatWindowLabel(activeWindowDays)} 暂无快照`}
            </p>
            <button
              type="button"
              className={styles.btnGhost}
              data-testid="digest-refresh-summary-close"
              onClick={() => {
                if (summaryHideTimerRef.current) {
                  clearTimeout(summaryHideTimerRef.current);
                  summaryHideTimerRef.current = null;
                }
                setRefreshSummaryVisible(false);
              }}
            >
              关闭
            </button>
          </div>
          <p>
            总量 {counts.total} · 待处理 {counts.pending} · 去学习 {counts.do} · 稍后看 {counts.later} ·
            忽略 {counts.drop}
          </p>
          {viewState.windowDays !== activeWindowDays ? (
            <p>
              你已选择 {formatWindowLabel(viewState.windowDays)}，点击“更新日报”后会切换到该范围。
            </p>
          ) : null}
          {lastRefresh ? (
            <>
              <p>
                抓取源 {lastRefresh.ingestion.sources}，新增 {lastRefresh.ingestion.signals}，去重{" "}
                {lastRefresh.ingestion.duplicates}，抓取失败 {lastRefresh.ingestion.errors}；处置卡生成{" "}
                {lastRefresh.triage.generated}/{lastRefresh.triage.requested}，失败 {lastRefresh.triage.failed}。
              </p>
              {lastRefresh.ingestion.errorDetails && lastRefresh.ingestion.errorDetails.length > 0 ? (
                <p>
                  失败源详情：
                  {lastRefresh.ingestion.errorDetails
                    .map((detail) => `${detail.sourceName ?? detail.rssUrl}（${detail.message}）`)
                    .join("；")}
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      {loading ? <section className={styles.ruleHint}>加载日报中...</section> : null}
      {error ? <section className={styles.formError}>错误：{error}</section> : null}
      {!loading && legacyNotice ? <section className={styles.ruleHint}>{legacyNotice}</section> : null}

      <section className={styles.signalList}>
        {!loading && !hasSnapshot ? (
          <section className={styles.empty}>
            当前范围未生成日报，请点击“更新日报”。
          </section>
        ) : null}

        {!loading && hasSnapshot && filteredSignals.length === 0 ? (
          <section className={styles.empty}>
            {viewState.tab === "pending"
              ? "没有待处理线索"
              : viewState.tab === "do"
                ? "还没有去学习线索"
                : viewState.tab === "later"
                  ? "还没有稍后看线索"
                  : "还没有忽略线索"}
          </section>
        ) : null}

        {pagedSignals.items.map((signal) => {
          const userDisposition = dispositions[signal.id] ?? "UNSET";
          const triage = triageBySignal[signal.id] ?? null;
          const preview = previewBySignal[signal.id] ?? null;
          const llmHint = preview
            ? formatLlmWarningHint({
                mode: preview.aiSummaryMode,
                warnings: preview.warnings
              })
            : null;
          const canOpenSession = userDisposition === "DO";
          const showResumeLabel = sessionHintBySignal[signal.id] || canOpenSession;

          return (
            <article key={signal.id} className={styles.signalCard} data-testid={`signal-${signal.id}`}>
              <div className={styles.signalMain}>
                <p className={styles.signalTitle}>{signal.title}</p>
                <p className={styles.signalMeta}>
                  {sourceName(signal)} · {formatDigestPublishedAt(signal.publishedAt)}
                </p>
                <p className={styles.signalSummary}>
                  {pickAiSummaryText({
                    aiSummary: preview?.aiSummary,
                    triageHeadline: triage?.headline,
                    summary: signal.summary
                  })}
                </p>
                {llmHint ? (
                  <p className={styles.ruleHint} data-testid={`signal-llm-hint-${signal.id}`}>
                    {llmHint}
                  </p>
                ) : null}
                <a className={styles.btnGhost} href={signal.url} target="_blank" rel="noreferrer">
                  打开原文
                </a>
              </div>

              <div className={styles.signalSide}>
                <div className={styles.badgeRow}>
                  <span className={styles.badgeStatus}>
                    建议：
                    {triage
                      ? formatSuggestionLabel(triage.label)
                      : triageBusyBySignal[signal.id]
                        ? `生成中（分流:${formatSuggestionLabel(signal.routing.label)}）`
                        : `分流:${formatSuggestionLabel(signal.routing.label)}`}
                  </span>
                  <span className={styles.badgeStrong}>你已选：{label(userDisposition)}</span>
                </div>

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.btnSubtle}
                    disabled={busySignalId === signal.id}
                    onClick={() => void handleDisposition(signal.id, "FYI")}
                  >
                    稍后看
                  </button>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    disabled={busySignalId === signal.id}
                    onClick={() => void handleDoAndEnterSession(signal.id)}
                    data-testid={`do-${signal.id}`}
                  >
                    去学习
                  </button>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    disabled={busySignalId === signal.id}
                    onClick={() => void handleDisposition(signal.id, "DROP")}
                  >
                    忽略
                  </button>
                </div>

                {canOpenSession ? (
                  <button
                    type="button"
                    className={styles.btnLink}
                    onClick={() => void enterSession(signal.id)}
                    data-testid={`session-cta-${signal.id}`}
                  >
                    {showResumeLabel ? "继续学习" : "进入学习会话"}
                  </button>
                ) : null}

                <button
                  type="button"
                  className={styles.btnGhost}
                  data-testid={`signal-reason-${signal.id}`}
                  onClick={() => {
                    void trackSignalEvent({
                      signalId: signal.id,
                      type: "TRIAGE_EXPANDED",
                      payloadJson: {
                        source: "digest"
                      }
                    }).catch(() => undefined);
                    setDrawerSignalId(signal.id);
                    void ensureSignalPreview(signal.id);
                  }}
                >
                  查看理由
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {filteredSignals.length > DIGEST_PAGE_SIZE ? (
        <section className={styles.paginationBar} data-testid="digest-pagination">
          <button
            type="button"
            className={styles.btnGhost}
            data-testid="digest-page-prev"
            disabled={pagedSignals.currentPage <= 1}
            onClick={() =>
              updateViewState({
                page: Math.max(1, viewState.page - 1)
              })
            }
          >
            上一页
          </button>
          <p className={styles.paginationHint} data-testid="digest-page-indicator">
            第 {pagedSignals.currentPage} / {pagedSignals.totalPages} 页 · 共 {pagedSignals.totalItems} 条
          </p>
          <button
            type="button"
            className={styles.btnGhost}
            data-testid="digest-page-next"
            disabled={pagedSignals.currentPage >= pagedSignals.totalPages}
            onClick={() =>
              updateViewState({
                page: Math.min(pagedSignals.totalPages, viewState.page + 1)
              })
            }
          >
            下一页
          </button>
        </section>
      ) : null}

      {drawerSignal ? (
        <DigestDrawer
          signal={drawerSignal}
          triage={triageBySignal[drawerSignal.id] ?? null}
          preview={previewBySignal[drawerSignal.id] ?? null}
          previewLoading={Boolean(previewLoadingBySignal[drawerSignal.id])}
          previewError={previewErrorBySignal[drawerSignal.id] ?? null}
          userDisposition={dispositions[drawerSignal.id] ?? "UNSET"}
          isGenerating={Boolean(triageBusyBySignal[drawerSignal.id])}
          onClose={() => setDrawerSignalId(null)}
          onGenerateTriage={() => {
            void ensureTriage(drawerSignal.id, triageRole);
          }}
          onSetDisposition={(value) => {
            if (value === "DO") {
              void handleDoAndEnterSession(drawerSignal.id);
              return;
            }
            void handleDisposition(drawerSignal.id, value);
          }}
        />
      ) : null}

      {confirmDialog ? (
        <ConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          cancelLabel={confirmDialog.cancelLabel}
          onCancel={() => closeConfirmDialog(false)}
          onConfirm={() => closeConfirmDialog(true)}
        />
      ) : null}
    </AppShell>
  );
}

export default function AppDigestPage() {
  return (
    <Suspense fallback={<DigestPageFallback />}>
      <AppDigestPageBody />
    </Suspense>
  );
}

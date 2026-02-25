"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MarkdownContent } from "@/components/markdown-content";
import styles from "@/app/demo-ui.module.css";
import {
  AppApiError,
  fetchSignalPreview,
  fetchSessionSuggestedQuestions,
  getSessionDetail,
  streamSessionAssistantReply,
  startSessionJob
} from "@/lib/client/app-api";
import { formatLlmWarningHint, formatSessionStreamErrorHint } from "@/lib/client/llm-warning-hints";
import type { JobStatusV2, JobTypeV2, SessionDetail, SessionJobView } from "@/lib/client/app-types";
import { generateSessionQuestionCards } from "@/lib/agent/session-question-agent";
import { pickAiSummaryText } from "@/lib/shared/ai-summary";

const LAST_SESSION_STORAGE_KEY = "fomo_firewall_last_session_id";

function jobStatusLabel(status: JobStatusV2 | "IDLE"): string {
  if (status === "DONE") return "已完成";
  if (status === "FAILED") return "失败";
  if (status === "RUNNING") return "进行中";
  if (status === "QUEUED") return "排队中";
  return "未开始";
}

function jobStatusToneClass(status: JobStatusV2 | "IDLE"): string {
  if (status === "DONE") return "statusDone";
  if (status === "FAILED") return "statusFailed";
  if (status === "RUNNING") return "statusRunning";
  if (status === "QUEUED") return "statusQueued";
  return "statusIdle";
}

function latestJob(jobs: SessionJobView[], type: JobTypeV2): SessionJobView | undefined {
  return [...jobs]
    .filter((job) => job.type === type)
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
    .at(-1);
}

function tryReadEvidenceId(job: SessionJobView | undefined): string | null {
  if (!job || !job.resultRefJson || typeof job.resultRefJson !== "object") {
    return null;
  }
  const value = (job.resultRefJson as { evidencePackId?: unknown }).evidencePackId;
  return typeof value === "string" ? value : null;
}

export default function AppSessionDetailPage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const sessionIdParam = params.sessionId;
  const sessionId = Array.isArray(sessionIdParam) ? sessionIdParam[0] : sessionIdParam;

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [jobBusyType, setJobBusyType] = useState<JobTypeV2 | null>(null);
  const [draft, setDraft] = useState("");
  const [streamingAssistant, setStreamingAssistant] = useState<string | null>(null);
  const [previewAiSummary, setPreviewAiSummary] = useState<string | null>(null);
  const [previewLlmHint, setPreviewLlmHint] = useState<string | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [suggestedQuestionsHint, setSuggestedQuestionsHint] = useState<string | null>(null);
  const [loadingSuggestedQuestions, setLoadingSuggestedQuestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const insightCardJob = useMemo(
    () => latestJob(session?.jobs ?? [], "INSIGHT_CARD"),
    [session?.jobs]
  );
  const evidenceJob = useMemo(
    () => latestJob(session?.jobs ?? [], "EVIDENCE_PACK"),
    [session?.jobs]
  );
  const evidenceId = tryReadEvidenceId(evidenceJob);
  const hasPendingJobs = useMemo(
    () => (session?.jobs ?? []).some((job) => job.status === "QUEUED" || job.status === "RUNNING"),
    [session?.jobs]
  );
  async function refreshSession(background = false): Promise<void> {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    if (!background) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await getSessionDetail(sessionId);
      setSession(data);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LAST_SESSION_STORAGE_KEY, data.id);
      }
    } catch (fetchError) {
      if (background) {
        return;
      }
      if (fetchError instanceof AppApiError) {
        setError(`${fetchError.code}: ${fetchError.message}`);
      } else {
        setError("SESSION_LOAD_FAILED");
      }
      setSession(null);
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void refreshSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !hasPendingJobs) {
      return;
    }
    const timer = window.setInterval(() => {
      void refreshSession(true);
    }, 1200);
    return () => {
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, hasPendingJobs]);

  useEffect(() => {
    let cancelled = false;
    async function loadSuggestedQuestions(): Promise<void> {
      if (!session || session.messages.length > 0) {
        setSuggestedQuestions([]);
        setSuggestedQuestionsHint(null);
        setLoadingSuggestedQuestions(false);
        return;
      }

      setLoadingSuggestedQuestions(true);
      try {
        const out = await fetchSessionSuggestedQuestions(session.id);
        if (cancelled) return;
        setSuggestedQuestions(out.questions.slice(0, 3));
        setSuggestedQuestionsHint(
          formatLlmWarningHint({
            mode: out.mode,
            warnings: out.warnings
          })
        );
      } catch {
        if (cancelled) return;
        setSuggestedQuestions(
          generateSessionQuestionCards({
            signal: {
              title: session.signal.title,
              summary: session.signal.summary,
              aiSummary: pickAiSummaryText({
                aiSummary: previewAiSummary,
                summary: session.signal.summary
              })
            },
            messages: session.messages.map((message) => ({
              role: message.role,
              content: message.content
            }))
          })
        );
        setSuggestedQuestionsHint(null);
      } finally {
        if (!cancelled) {
          setLoadingSuggestedQuestions(false);
        }
      }
    }

    void loadSuggestedQuestions();
    return () => {
      cancelled = true;
    };
  }, [previewAiSummary, session]);

  useEffect(() => {
    async function loadPreviewSummary(): Promise<void> {
      if (!session) {
        setPreviewAiSummary(null);
        setPreviewLlmHint(null);
        return;
      }
      try {
        const preview = await fetchSignalPreview(session.signal.id);
        setPreviewAiSummary(preview.aiSummary || null);
        setPreviewLlmHint(
          formatLlmWarningHint({
            mode: preview.aiSummaryMode,
            warnings: preview.warnings
          })
        );
      } catch {
        setPreviewAiSummary(null);
        setPreviewLlmHint(null);
      }
    }

    void loadPreviewSummary();
  }, [session]);

  const sessionSummary = useMemo(() => {
    if (!session) {
      return "";
    }
    return pickAiSummaryText({
      aiSummary: previewAiSummary,
      summary: session.signal.summary
    });
  }, [previewAiSummary, session]);

  async function sendMessage(content: string): Promise<void> {
    if (!sessionId) return;
    const trimmed = content.trim();
    if (!trimmed) return;

    setSending(true);
    setError(null);
    setStreamingAssistant("");
    try {
      await streamSessionAssistantReply({
        sessionId,
        content: trimmed,
        onAck: (payload) => {
          setSession((current) => {
            if (!current) return current;
            const exists = current.messages.some((message) => message.id === payload.userMessage.id);
            return exists
              ? current
              : {
                  ...current,
                  messages: [...current.messages, payload.userMessage]
                };
          });
          setDraft("");
        },
        onDelta: (payload) => {
          setStreamingAssistant((current) => `${current ?? ""}${payload.text}`);
        },
        onDone: (payload) => {
          setStreamingAssistant(null);
          setSession((current) => {
            if (!current) return current;
            const exists = current.messages.some(
              (message) => message.id === payload.assistantMessage.id
            );
            return exists
              ? current
              : {
                  ...current,
                  messages: [...current.messages, payload.assistantMessage]
                };
          });
        },
        onError: (payload) => {
          setStreamingAssistant(null);
          const hint = formatSessionStreamErrorHint({
            code: payload.code,
            message: payload.message
          });
          setError(hint ? `${payload.code}: ${hint}` : `${payload.code}: ${payload.message}`);
        }
      });
    } catch (sendError) {
      if (sendError instanceof AppApiError) {
        const hint = formatSessionStreamErrorHint({
          code: sendError.code,
          message: sendError.message
        });
        setError(hint ? `${sendError.code}: ${hint}` : `${sendError.code}: ${sendError.message}`);
      } else {
        setError("SESSION_SEND_FAILED");
      }
      setStreamingAssistant(null);
    } finally {
      setSending(false);
    }
  }

  async function handleStartJob(type: JobTypeV2): Promise<void> {
    if (!sessionId) return;
    setJobBusyType(type);
    setError(null);
    try {
      const job = await startSessionJob({
        sessionId,
        type
      });
      setSession((current) => {
        if (!current) return current;
        const otherJobs = current.jobs.filter((item) => item.id !== job.id);
        return {
          ...current,
          jobs: [...otherJobs, job]
        };
      });
    } catch (jobError) {
      if (jobError instanceof AppApiError) {
        setError(`${jobError.code}: ${jobError.message}`);
      } else {
        setError("SESSION_JOB_FAILED");
      }
    } finally {
      setJobBusyType(null);
    }
  }

  async function backToSessionHome(): Promise<void> {
    router.push("/app/session");
  }

  if (loading) {
    return (
      <AppShell active="session" title="学习会话" subtitle="正在加载会话...">
        <section className={styles.ruleHint}>加载中...</section>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell active="session" title="学习会话" subtitle="会话不存在">
        <section className={styles.empty}>未找到会话。请返回学习会话列表重新进入。</section>
        {error ? <p className={styles.formError}>错误：{error}</p> : null}
        <button type="button" className={styles.btn} onClick={() => router.push("/app/session")}>
          返回会话列表
        </button>
      </AppShell>
    );
  }

  const shouldShowSuggestedQuestions = session.messages.length === 0 && !sending;

  return (
    <AppShell active="session" title="学习会话" subtitle="消息自动保存，会话可恢复。">
      <div className={styles.sessionWorkspace} data-testid="session-page">
        <section className={styles.sessionChatShell}>
          <header className={styles.sessionHeader}>
            <div>
              <h2>{session.signal.title}</h2>
              <p>{session.signal.source.name ?? "未命名来源"}</p>
            </div>

            <div className={styles.inlineActions}>
              <button
                type="button"
                className={styles.btnGhost}
                data-testid="back-session-home"
                onClick={() => void backToSessionHome()}
              >
                返回会话列表
              </button>
            </div>
          </header>

          <section className={styles.sessionMessagesViewport} data-testid="session-messages-viewport">
            <div className={styles.sessionMessagesList}>
              {session.messages.length === 0 ? (
                <p className={styles.ruleHint}>先问一个问题，开始本次学习。</p>
              ) : null}

              {session.messages.map((message) => (
                <div
                  key={message.id}
                  className={message.role === "USER" ? styles.chatBubbleUser : styles.chatBubbleAssistant}
                >
                  <strong>{message.role === "USER" ? "你" : "助手"}</strong>
                  {message.role === "USER" ? (
                    <p>{message.content}</p>
                  ) : (
                    <MarkdownContent content={message.content} className={styles.markdownBody} />
                  )}
                </div>
              ))}
              {streamingAssistant !== null ? (
                <div className={styles.chatBubbleAssistant} data-testid="session-streaming-assistant">
                  <strong>助手</strong>
                  {streamingAssistant ? (
                    <MarkdownContent content={streamingAssistant} className={styles.markdownBody} />
                  ) : (
                    <p>思考中...</p>
                  )}
                </div>
              ) : null}
            </div>
          </section>

          <div className={styles.sessionComposerBar}>
            <div className={styles.composerRow}>
              <input
                className={styles.input}
                value={draft}
                data-testid="session-input"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="输入问题..."
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !sending) {
                    void sendMessage(draft);
                  }
                }}
              />
              <button
                type="button"
                className={styles.btnPrimary}
                data-testid="session-send"
                disabled={sending}
                onClick={() => void sendMessage(draft)}
              >
                发送
              </button>
            </div>
            {error ? <p className={styles.formError}>错误：{error}</p> : null}
          </div>
        </section>

        <aside className={styles.sessionSidebar} data-testid="session-sidebar">
          <div className={styles.sessionSidebarScroll}>
            <section className={styles.sidebarSection}>
              <div className={styles.sidebarSectionHeader}>
                <h3>会话信息</h3>
                <Link href={session.signal.url} className={styles.btnGhost} target="_blank">
                  打开原文
                </Link>
              </div>
              <p className={styles.summaryTitle}>AI 总结</p>
              {previewLlmHint ? <p className={styles.ruleHint}>{previewLlmHint}</p> : null}
              <p className={styles.summaryContent}>
                {sessionSummary || "暂无摘要，先发起一轮学习会话即可生成更完整总结。"}
              </p>
            </section>

            {shouldShowSuggestedQuestions ? (
              <section className={styles.sidebarSection} data-testid="session-suggested-questions">
                <h3>你可能想问</h3>
                {loadingSuggestedQuestions ? (
                  <p className={styles.ruleHint}>AI 正在阅读这条 feed，生成首轮建议问题...</p>
                ) : null}
                {suggestedQuestionsHint ? (
                  <p className={styles.ruleHint} data-testid="session-suggested-questions-llm-hint">
                    {suggestedQuestionsHint}
                  </p>
                ) : null}
                <div className={styles.questionRow}>
                  {suggestedQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      className={styles.question}
                      data-testid="session-suggested-question"
                      disabled={sending}
                      onClick={() => void sendMessage(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section className={styles.sidebarSection}>
              <div className={styles.sidebarSectionHeader}>
                <h3>工具栏</h3>
              </div>
              <div className={styles.toolRows}>
                <div className={styles.toolRow}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.jobActionButton}`}
                    data-testid="job-insight-card"
                    disabled={jobBusyType === "INSIGHT_CARD"}
                    onClick={() => void handleStartJob("INSIGHT_CARD")}
                  >
                    生成洞察卡
                  </button>
                  <span
                    className={`${styles.jobStatus} ${styles[jobStatusToneClass(insightCardJob?.status ?? "IDLE")]}`}
                    data-testid="insight-card-status"
                  >
                    {jobStatusLabel(insightCardJob?.status ?? "IDLE")}
                  </span>
                </div>
                {insightCardJob?.status === "DONE" ? (
                  <div className={styles.toolLinkRow}>
                    <button
                      type="button"
                      className={styles.btnLink}
                      data-testid="view-insight-card"
                      onClick={() => router.push(`/app/cards?focusSession=${session.id}`)}
                    >
                      查看洞察卡
                    </button>
                  </div>
                ) : null}

                <div className={styles.toolRow}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.jobActionButton}`}
                    disabled={jobBusyType === "EVIDENCE_PACK"}
                    onClick={() => void handleStartJob("EVIDENCE_PACK")}
                  >
                    生成证据包
                  </button>
                  <span
                    className={`${styles.jobStatus} ${styles[jobStatusToneClass(evidenceJob?.status ?? "IDLE")]}`}
                  >
                    {jobStatusLabel(evidenceJob?.status ?? "IDLE")}
                  </span>
                </div>
                {evidenceJob?.status === "DONE" && evidenceId ? (
                  <div className={styles.toolLinkRow}>
                    <button
                      type="button"
                      className={styles.btnLink}
                      onClick={() => router.push(`/app/evidence/${evidenceId}`)}
                    >
                      查看证据包
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

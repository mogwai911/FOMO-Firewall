"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ConfirmModal } from "@/components/confirm-modal";
import styles from "@/app/demo-ui.module.css";
import { AppApiError, deleteSession, fetchSessionList } from "@/lib/client/app-api";
import type { SessionListItemView } from "@/lib/client/app-types";
import { pickAiSummaryText } from "@/lib/shared/ai-summary";

function statusLabel(status: SessionListItemView["status"]): string {
  if (status === "ACTIVE" || status === "PAUSED") return "可继续";
  return "已关闭";
}

export default function AppSessionHomePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionListItemView[]>([]);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessions(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchSessionList({
          limit: 20,
          statuses: ["ACTIVE", "PAUSED"]
        });
        setSessions(rows);
      } catch (loadError) {
        if (loadError instanceof AppApiError) {
          setError(`${loadError.code}: ${loadError.message}`);
        } else {
          setError("SESSION_LIST_LOAD_FAILED");
        }
        setSessions([]);
      } finally {
        setLoading(false);
      }
    }

    void loadSessions();
  }, []);

  async function handleDeleteSession(sessionId: string): Promise<void> {
    setBusySessionId(sessionId);
    setError(null);
    try {
      await deleteSession(sessionId);
      setSessions((current) => current.filter((session) => session.id !== sessionId));
    } catch (deleteError) {
      if (deleteError instanceof AppApiError) {
        setError(`${deleteError.code}: ${deleteError.message}`);
      } else {
        setError("SESSION_DELETE_FAILED");
      }
    } finally {
      setBusySessionId(null);
      setConfirmDeleteSessionId(null);
    }
  }

  return (
    <AppShell
      active="session"
      title="学习会话"
      subtitle="从日报进入新会话，或在这里继续最近的学习记录。"
    >
      {loading ? <section className={styles.ruleHint}>加载会话列表中...</section> : null}
      {error ? <section className={styles.formError}>错误：{error}</section> : null}

      {!loading && sessions.length === 0 ? (
        <section className={styles.empty}>还没有会话。请先到“日报处置”点击“去学习”。</section>
      ) : null}

      <section className={styles.signalList} data-testid="session-home-list">
        {sessions.map((session) => (
          <article key={session.id} className={styles.signalCard}>
            <div className={styles.signalMain}>
              <p className={styles.signalTitle}>{session.signal.title}</p>
              <p className={styles.signalMeta}>
                {session.signal.source.name ?? "未命名来源"} · {statusLabel(session.status)}
              </p>
              <p className={styles.signalSummary}>
                {pickAiSummaryText({
                  aiSummary: session.signal.aiSummary,
                  summary: session.signal.summary
                })}
              </p>
              <p className={styles.ruleHint}>消息数：{session.messageCount}</p>
            </div>

            <div className={styles.signalSide}>
              <button
                type="button"
                className={styles.btnLink}
                onClick={() => router.push(`/app/session/${session.id}`)}
              >
                继续学习
              </button>
              <button
                type="button"
                className={styles.btnDanger}
                disabled={busySessionId === session.id}
                data-testid={`session-delete-${session.id}`}
                onClick={() => setConfirmDeleteSessionId(session.id)}
              >
                删除会话
              </button>
            </div>
          </article>
        ))}
      </section>

      {confirmDeleteSessionId ? (
        <ConfirmModal
          title="删除这个学习会话？"
          message="删除后会清理该会话消息与作业记录；已生成的证据包会保留，但不能再回到该会话。"
          confirmLabel="确认删除"
          cancelLabel="取消"
          onCancel={() => setConfirmDeleteSessionId(null)}
          onConfirm={() => void handleDeleteSession(confirmDeleteSessionId)}
        />
      ) : null}
    </AppShell>
  );
}

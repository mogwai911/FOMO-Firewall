"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import styles from "@/app/demo-ui.module.css";
import {
  AppApiError,
  createOrResumeSession,
  fetchFyiSignals,
  setSignalDisposition
} from "@/lib/client/app-api";
import type { FyiSignalView } from "@/lib/client/app-types";
import { formatDigestPublishedAt } from "@/lib/client/digest-view";

export default function AppFyiPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<FyiSignalView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySignalId, setBusySignalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadFyiSignals(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchFyiSignals();
      setSignals(rows);
    } catch (fetchError) {
      if (fetchError instanceof AppApiError) {
        setError(`${fetchError.code}: ${fetchError.message}`);
      } else {
        setError("LATER_LOAD_FAILED");
      }
      setSignals([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFyiSignals();
  }, []);

  async function continueLearning(signalId: string): Promise<void> {
    setBusySignalId(signalId);
    setError(null);
    try {
      await setSignalDisposition(signalId, "DO");
      const session = await createOrResumeSession(signalId);
      router.push(`/app/session/${session.id}`);
    } catch (actionError) {
      if (actionError instanceof AppApiError) {
        setError(`${actionError.code}: ${actionError.message}`);
      } else {
        setError("LATER_TO_SESSION_FAILED");
      }
    } finally {
      setBusySignalId(null);
    }
  }

  return (
    <AppShell active="digest" title="稍后看池" subtitle="汇总你标记为“稍后看”的线索。">
      {loading ? <section className={styles.ruleHint}>加载中...</section> : null}
      {error ? <section className={styles.formError}>错误：{error}</section> : null}

      <section className={styles.signalList} data-testid="fyi-list">
        {!loading && signals.length === 0 ? (
          <section className={styles.empty}>暂无“稍后看”线索。</section>
        ) : null}

        {signals.map((signal) => (
          <article key={signal.id} className={styles.signalCard}>
            <div className={styles.signalMain}>
              <p className={styles.signalTitle}>{signal.title}</p>
              <p className={styles.signalMeta}>
                {signal.source.name ?? "未命名来源"} · {formatDigestPublishedAt(signal.publishedAt)}
              </p>
              <p className={styles.signalSummary}>{signal.summary ?? "暂无摘要"}</p>
              <a className={styles.btnGhost} href={signal.url} target="_blank" rel="noreferrer">
                打开原文
              </a>
            </div>

            <div className={styles.signalSide}>
              <div className={styles.badgeRow}>
                <span className={styles.badgeStatus}>稍后看</span>
                <span className={styles.badgeStrong}>
                  标记时间：{formatDigestPublishedAt(signal.dispositionUpdatedAt)}
                </span>
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  disabled={busySignalId === signal.id}
                  onClick={() => void continueLearning(signal.id)}
                >
                  去学习
                </button>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => router.push("/app/digest")}
                >
                  回日报
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </AppShell>
  );
}

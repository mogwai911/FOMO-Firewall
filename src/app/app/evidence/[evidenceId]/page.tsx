"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import styles from "@/app/demo-ui.module.css";
import { AppApiError, fetchEvidencePackDetail } from "@/lib/client/app-api";
import type { EvidencePackDetailView } from "@/lib/client/app-types";

export default function AppEvidencePage() {
  const router = useRouter();
  const params = useParams<{ evidenceId: string }>();
  const evidenceIdParam = params.evidenceId;
  const evidenceId = Array.isArray(evidenceIdParam) ? evidenceIdParam[0] : evidenceIdParam;

  const [pack, setPack] = useState<EvidencePackDetailView | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPack(): Promise<void> {
      if (!evidenceId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const payload = await fetchEvidencePackDetail(evidenceId);
        setPack(payload);
      } catch (fetchError) {
        if (fetchError instanceof AppApiError) {
          setError(`${fetchError.code}: ${fetchError.message}`);
        } else {
          setError("EVIDENCE_LOAD_FAILED");
        }
        setPack(null);
      } finally {
        setLoading(false);
      }
    }

    void loadPack();
  }, [evidenceId]);

  if (loading) {
    return (
      <AppShell active="memory" title="记忆库" subtitle="正在加载证据包">
        <section className={styles.ruleHint}>加载中...</section>
      </AppShell>
    );
  }

  if (!pack) {
    return (
      <AppShell active="memory" title="记忆库" subtitle="未找到证据包">
        <section className={styles.empty}>证据包不存在。请回到学习会话重新生成。</section>
        {error ? <p className={styles.formError}>错误：{error}</p> : null}
        <button type="button" className={styles.btn} onClick={() => router.push("/app/cards")}>
          返回记忆卡
        </button>
      </AppShell>
    );
  }

  return (
    <AppShell active="memory" title="记忆库" subtitle="摘要、引用、链接与可折叠的会话记录。">
      <section className={styles.gridTwo} data-testid="evidence-main-sections">
        <article className={styles.panel}>
          <h3>摘要</h3>
          <p>{pack.summary || "暂无摘要"}</p>
          <div className={styles.badgeRow}>
            <span className={styles.badge}>引用 {pack.keyQuotes.length} 条</span>
            <span className={styles.badge}>链接 {pack.links.length} 条</span>
            <span className={styles.badge}>会话片段 {pack.transcript.length} 条</span>
          </div>
        </article>

        <article className={styles.panel}>
          <h3>关键引用</h3>
          <ul className={styles.linkList}>
            {pack.keyQuotes.length > 0 ? (
              pack.keyQuotes.map((quote, index) => <li key={`${pack.id}-quote-${index + 1}`}>{quote}</li>)
            ) : (
              <li>暂无引用，建议继续会话补充。</li>
            )}
          </ul>
        </article>

        <article className={styles.panel}>
          <h3>链接</h3>
          <ul className={styles.linkList}>
            {pack.links.length > 0 ? (
              pack.links.map((link) => (
                <li key={link}>
                  <a href={link} target="_blank" rel="noreferrer">
                    {link}
                  </a>
                </li>
              ))
            ) : (
              <li>暂无外部链接</li>
            )}
          </ul>
        </article>

        <article className={styles.panel}>
          <h3>会话回溯</h3>
          {pack.sessionAvailable ? (
            <>
              <section className={styles.collapsible}>
                <button type="button" className={styles.btnGhost} onClick={() => setExpanded((value) => !value)}>
                  {expanded ? "收起全量对话" : "展开全量对话"}
                </button>

                {expanded ? (
                  <ul className={styles.transcript}>
                    {pack.transcript.map((item) => (
                      <li key={item.id}>
                        {item.role === "USER" ? "你" : "助手"}：{item.content}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>

              {pack.sessionId ? (
                <button
                  type="button"
                  className={styles.btnLink}
                  onClick={() => router.push(`/app/session/${pack.sessionId}`)}
                >
                  继续聊（回到会话）
                </button>
              ) : null}
            </>
          ) : (
            <p className={styles.ruleHint}>会话已删除，无法继续回到会话。</p>
          )}
        </article>
      </section>
    </AppShell>
  );
}

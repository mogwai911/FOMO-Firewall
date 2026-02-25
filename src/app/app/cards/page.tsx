"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ConfirmModal } from "@/components/confirm-modal";
import styles from "@/app/demo-ui.module.css";
import {
  AppApiError,
  deleteInsightCard,
  fetchEvidencePacks,
  fetchInsightCards
} from "@/lib/client/app-api";
import type { EvidencePackSummaryView, InsightCardView } from "@/lib/client/app-types";

interface InsightEvidence {
  text: string;
  from: "conversation" | "rss_summary";
}

interface InsightCardContent {
  signalTitle: string;
  abstract: string;
  keyPoints: string[];
  evidence: InsightEvidence[];
  limitations: string[];
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function readInsightCardContent(card: InsightCardView): InsightCardContent {
  const raw = card.insightJson;
  if (!raw || typeof raw !== "object") {
    return {
      signalTitle: "未命名洞察",
      abstract: "暂无洞察内容，请返回会话重新生成。",
      keyPoints: ["当前洞察内容不足。"],
      evidence: [],
      limitations: ["暂无可用局限信息。"]
    };
  }

  const value = raw as {
    signal_title?: unknown;
    abstract?: unknown;
    key_points?: unknown;
    evidence?: unknown;
    limitations?: unknown;
    value_summary?: unknown;
    core_insights?: unknown;
    key_evidence?: unknown;
    risk_boundary?: unknown;
  };

  const parseEvidence = (candidate: unknown): InsightEvidence[] =>
    Array.isArray(candidate)
      ? candidate
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const row = item as { text?: unknown; from?: unknown };
          if (typeof row.text !== "string" || row.text.length === 0) {
            return null;
          }
          return {
            text: row.text,
              from: row.from === "rss_summary" ? "rss_summary" : "conversation"
            } as InsightEvidence;
        })
        .filter((item): item is InsightEvidence => item !== null)
      : [];

  return {
    signalTitle: typeof value.signal_title === "string" ? value.signal_title : "未命名洞察",
    abstract:
      typeof value.abstract === "string"
        ? value.abstract
        : typeof value.value_summary === "string"
          ? value.value_summary
          : "暂无洞察内容",
    keyPoints: (() => {
      const v2Points = asStringArray(value.key_points);
      if (v2Points.length > 0) return v2Points;
      const v1Points = asStringArray(value.core_insights);
      if (v1Points.length > 0) return v1Points;
      return ["暂无核心论点。"];
    })(),
    evidence: (() => {
      const v2Evidence = parseEvidence(value.evidence);
      if (v2Evidence.length > 0) return v2Evidence;
      return parseEvidence(value.key_evidence);
    })(),
    limitations: (() => {
      const v2Limitations = asStringArray(value.limitations);
      if (v2Limitations.length > 0) return v2Limitations;
      const v1Limitations = asStringArray(value.risk_boundary);
      if (v1Limitations.length > 0) return v1Limitations;
      return ["暂无局限边界信息。"];
    })()
  };
}

export default function AppCardsPage() {
  const router = useRouter();

  const [cards, setCards] = useState<InsightCardView[]>([]);
  const [packs, setPacks] = useState<EvidencePackSummaryView[]>([]);
  const [focusSessionId, setFocusSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [deleteCandidateCardId, setDeleteCandidateCardId] = useState<string | null>(null);
  const [deletingInsightCardId, setDeletingInsightCardId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    setFocusSessionId(params.get("focusSession"));
  }, []);

  useEffect(() => {
    async function loadCards(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const [cardList, packList] = await Promise.all([
          fetchInsightCards({
            limit: 100
          }),
          fetchEvidencePacks({
            limit: 100
          })
        ]);
        setCards(cardList);
        setPacks(packList);
      } catch (fetchError) {
        if (fetchError instanceof AppApiError) {
          setError(`${fetchError.code}: ${fetchError.message}`);
        } else {
          setError("INSIGHT_CARDS_LOAD_FAILED");
        }
      } finally {
        setLoading(false);
      }
    }

    void loadCards();
  }, []);

  const deckCards = useMemo(
    () => (focusSessionId ? cards.filter((card) => card.sessionId === focusSessionId) : cards),
    [cards, focusSessionId]
  );

  const filteredCards = useMemo(() => {
    const lowered = keyword.trim().toLowerCase();
    if (!lowered) {
      return deckCards;
    }
    return deckCards.filter((card) => {
      const content = readInsightCardContent(card);
      return (
        content.signalTitle.toLowerCase().includes(lowered) ||
        content.abstract.toLowerCase().includes(lowered) ||
        content.keyPoints.join(" ").toLowerCase().includes(lowered)
      );
    });
  }, [deckCards, keyword]);
  const expandAbstractPreview = filteredCards.length <= 3;

  const selectedCard =
    filteredCards.find((card) => card.id === selectedCardId) ?? filteredCards[0] ?? null;
  const selectedCardContent = selectedCard ? readInsightCardContent(selectedCard) : null;
  const linkedEvidence = selectedCard
    ? packs.find((pack) => pack.sessionId === selectedCard.sessionId)
    : undefined;

  async function handleDeleteInsightCard(): Promise<void> {
    if (!deleteCandidateCardId) {
      return;
    }

    const targetCardId = deleteCandidateCardId;
    setDeleteCandidateCardId(null);
    setDeletingInsightCardId(targetCardId);
    setError(null);
    try {
      await deleteInsightCard(targetCardId);
      setCards((current) => current.filter((card) => card.id !== targetCardId));
      setSelectedCardId((current) => (current === targetCardId ? null : current));
    } catch (deleteError) {
      if (deleteError instanceof AppApiError) {
        setError(`${deleteError.code}: ${deleteError.message}`);
      } else {
        setError("INSIGHT_CARD_DELETE_FAILED");
      }
    } finally {
      setDeletingInsightCardId(null);
    }
  }

  return (
    <AppShell active="memory" title="记忆库" subtitle="高密度洞察卡 + 证据回溯。">
      <section className={styles.controlBar}>
        <input
          className={styles.input}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索洞察卡标题 / 摘要 / 关键词"
        />
        <p className={styles.ruleHint} data-testid="insight-card-count">
          共 {filteredCards.length} 条洞察卡
        </p>
      </section>

      {loading ? <section className={styles.ruleHint}>加载洞察卡中...</section> : null}
      {error ? <section className={styles.formError}>错误：{error}</section> : null}

      {!loading && deckCards.length === 0 ? (
        <section className={styles.empty}>还没有洞察卡。请在学习会话里点击“生成洞察卡”。</section>
      ) : null}

      <section
        className={`${styles.gridTwo} ${styles.insightGrid}`}
        data-testid="insight-library-page"
      >
        <article className={`${styles.panel} ${styles.insightListPanel}`}>
          <h3 className={styles.insightPanelTitle}>洞察卡列表</h3>
          <ul className={styles.libraryList}>
            {filteredCards.map((card) => {
              const content = readInsightCardContent(card);
              return (
                <li key={card.id} className={`${styles.libraryItem} ${styles.insightListCard}`}>
                  <strong className={styles.insightListTitle}>{content.signalTitle}</strong>
                  <p
                    className={`${styles.insightAbstractPreview} ${
                      expandAbstractPreview ? styles.insightAbstractExpanded : ""
                    }`}
                  >
                    {content.abstract}
                  </p>
                  <button
                    type="button"
                    className={`${styles.btnGhost} ${styles.insightListAction}`}
                    onClick={() => setSelectedCardId(card.id)}
                  >
                    查看详情
                  </button>
                </li>
              );
            })}
          </ul>
        </article>

        <article className={`${styles.panel} ${styles.insightDetailPanel}`}>
          <h3 className={styles.insightPanelTitle}>洞察详情</h3>
          {selectedCard && selectedCardContent ? (
            <>
              <h4 className={styles.insightSectionHeading}>摘要</h4>
              <p className={styles.insightDetailAbstract}>{selectedCardContent.abstract}</p>

              <h4 className={styles.insightSectionHeading}>核心论点</h4>
              <ul className={styles.insightDetailList}>
                {selectedCardContent.keyPoints.map((insight) => (
                  <li key={insight}>{insight}</li>
                ))}
              </ul>

              <h4 className={styles.insightSectionHeading}>关键证据</h4>
              <ul className={styles.insightDetailList}>
                {selectedCardContent.evidence.map((evidence, index) => (
                  <li key={`${evidence.from}-${index}`}>
                    {evidence.text}
                    <small className={styles.insightEvidenceSource}>
                      （{evidence.from === "rss_summary" ? "RSS 摘要" : "会话"}）
                    </small>
                  </li>
                ))}
              </ul>

              <h4 className={styles.insightSectionHeading}>局限边界</h4>
              <ul className={styles.insightDetailList}>
                {selectedCardContent.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.btnLink}
                  data-testid="insight-detail-back-session"
                  onClick={() => router.push(`/app/session/${selectedCard.sessionId}`)}
                >
                  回溯会话
                </button>
                {linkedEvidence ? (
                  <button
                    type="button"
                    className={styles.btnLink}
                    onClick={() => router.push(`/app/evidence/${linkedEvidence.id}`)}
                  >
                    查看证据包
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => router.push(`/app/session/${selectedCard.sessionId}`)}
                  >
                    证据包未生成，去会话生成
                  </button>
                )}
                <button
                  type="button"
                  className={styles.btnDanger}
                  data-testid="insight-detail-delete"
                  disabled={deletingInsightCardId === selectedCard.id}
                  onClick={() => setDeleteCandidateCardId(selectedCard.id)}
                >
                  {deletingInsightCardId === selectedCard.id ? "删除中..." : "删除洞察卡"}
                </button>
              </div>
            </>
          ) : (
            <p>暂无洞察卡。</p>
          )}
        </article>
      </section>

      {deleteCandidateCardId ? (
        <ConfirmModal
          title="删除洞察卡？"
          message="删除后无法恢复，这条洞察卡会从记忆库中移除。"
          confirmLabel="确认删除"
          cancelLabel="取消"
          onCancel={() => setDeleteCandidateCardId(null)}
          onConfirm={() => void handleDeleteInsightCard()}
        />
      ) : null}
    </AppShell>
  );
}

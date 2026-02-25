"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "@/app/demo-ui.module.css";
import { formatLlmWarningHint } from "@/lib/client/llm-warning-hints";
import type {
  DigestSignal,
  DispositionLabel,
  SignalPreviewView,
  TriageCardView
} from "@/lib/client/app-types";
import { formatDispositionLabel } from "@/lib/client/digest-view";

type DispositionView = DispositionLabel | "UNSET";

interface DigestDrawerProps {
  signal: DigestSignal;
  triage: TriageCardView | null;
  preview: SignalPreviewView | null;
  previewLoading: boolean;
  previewError: string | null;
  userDisposition: DispositionView;
  isGenerating: boolean;
  onClose: () => void;
  onSetDisposition: (value: DispositionLabel) => void;
  onGenerateTriage: () => void;
}

function label(value: DispositionView): string {
  return formatDispositionLabel(value);
}

function nextActionHintLabel(value: TriageCardView["nextActionHint"]): string {
  if (value === "ENTER_SESSION") return "去学习";
  if (value === "BOOKMARK") return "稍后看";
  return "忽略";
}

export function DigestDrawer({
  signal,
  triage,
  preview,
  previewLoading,
  previewError,
  userDisposition,
  isGenerating,
  onClose,
  onSetDisposition,
  onGenerateTriage
}: DigestDrawerProps) {
  const [showOriginalContent, setShowOriginalContent] = useState(false);
  const originalLink = preview?.originalUrl || signal.url;
  const collapsedOriginalPreview =
    preview?.articleContent && preview.articleContent.length > 220
      ? `${preview.articleContent.slice(0, 220)}...`
      : preview?.articleContent;
  const quoteItems =
    preview?.aiSummary?.trim()
      ? [preview.aiSummary.trim()]
      : (triage?.snippets ?? [])
          .map((snippet) => snippet.text.trim())
          .filter((snippet) => snippet.length > 0);
  const previewLlmHint = preview
    ? formatLlmWarningHint({
        mode: preview.aiSummaryMode,
        warnings: preview.warnings
      })
    : null;

  useEffect(() => {
    setShowOriginalContent(false);
  }, [signal.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
    return;
  }, [onClose]);

  const content = (
    <div className={styles.drawerOverlay} data-testid="digest-drawer-overlay">
      <button
        type="button"
        aria-label="关闭处置理由"
        className={styles.drawerBackdrop}
        data-testid="digest-drawer-backdrop"
        onClick={onClose}
      />
      <aside
        className={`${styles.drawer} ${styles.drawerPanel}`}
        data-testid="digest-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="处置理由"
      >
        <div className={styles.drawerHeader}>
          <h4 className={styles.drawerTitle}>处置理由</h4>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            关闭
          </button>
        </div>

        <div className={styles.badgeRow}>
          <span className={styles.badgeStrong}>你已选：{label(userDisposition)}</span>
          <span className={styles.badge}>来源：{signal.source.name ?? "未知来源"}</span>
        </div>
        <p className={styles.ruleHint}>{signal.title}</p>

        <section className={styles.drawerSection} data-testid="digest-drawer-summary-section">
          <h4 className={styles.drawerSectionTitle}>AI 总结</h4>
          {previewLoading ? <p className={styles.ruleHint}>正在加载原文并生成总结...</p> : null}
          {previewError ? <p className={styles.formError}>{previewError}</p> : null}
          {previewLlmHint ? (
            <p className={styles.ruleHint} data-testid="digest-drawer-llm-hint">
              {previewLlmHint}
            </p>
          ) : null}
          <p>{preview?.aiSummary ?? triage?.headline ?? signal.summary ?? "暂无总结"}</p>
        </section>

        <section className={styles.drawerSection} data-testid="digest-drawer-original-section">
          <h4 className={styles.drawerSectionTitle}>原文内容</h4>
          {preview?.articleContent ? (
            <>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setShowOriginalContent((current) => !current)}
              >
                {showOriginalContent ? "收起原文内容" : "展开原文内容"}
              </button>
              <blockquote>{showOriginalContent ? preview.articleContent : collapsedOriginalPreview}</blockquote>
            </>
          ) : (
            <p>原文内容暂不可用，可点击原文链接查看。</p>
          )}
          <a className={styles.btnLink} href={originalLink} target="_blank" rel="noreferrer">
            打开原文链接
          </a>
        </section>

        {!triage ? (
          <section className={styles.drawerSection}>
            <p>建议生成中或尚未生成。</p>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={isGenerating}
              onClick={onGenerateTriage}
            >
              {isGenerating ? "生成中..." : "生成处置卡"}
            </button>
          </section>
        ) : (
          <section className={styles.drawerSection} data-testid="digest-drawer-reason-section">
            <h4 className={styles.drawerSectionTitle}>价值判断</h4>
            <p>{triage.headline}</p>
            <ul>
              {(triage.reasons.length > 0
                ? triage.reasons
                : [{ type: "relevance", text: "暂无结构化理由", confidence: 0 } as const]
              ).map((reason, index) => (
                <li key={`${signal.id}-reason-${index + 1}`}>{reason.text}</li>
              ))}
            </ul>

            <h4 className={styles.drawerSectionTitle}>引用片段</h4>
            {(quoteItems.length > 0 ? quoteItems : [signal.summary ?? "暂无引用片段"]).map(
              (quote, index) => (
                <blockquote key={`${signal.id}-snippet-${index + 1}`}>{quote}</blockquote>
              )
            )}

            <h4 className={styles.drawerSectionTitle}>建议动作</h4>
            <p>{nextActionHintLabel(triage.nextActionHint)}</p>
          </section>
        )}

        <div className={styles.drawerFooter}>
          <button type="button" className={styles.btnSubtle} onClick={() => onSetDisposition("FYI")}>
            稍后看
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => onSetDisposition("DO")}>
            去学习
          </button>
          <button type="button" className={styles.btnDanger} onClick={() => onSetDisposition("DROP")}>
            忽略
          </button>
        </div>
      </aside>
    </div>
  );

  if (typeof document === "undefined") {
    return content;
  }
  return createPortal(content, document.body);
}

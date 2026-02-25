"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "@/app/demo-ui.module.css";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onCancel]);

  const content = (
    <div className={styles.confirmOverlay} data-testid="confirm-modal" role="dialog" aria-modal="true">
      <button
        type="button"
        className={styles.confirmBackdrop}
        data-testid="confirm-modal-backdrop"
        onClick={onCancel}
        aria-label="关闭确认弹窗"
      />
      <section className={styles.confirmDialog} data-testid="confirm-modal-panel">
        <h3 className={styles.confirmTitle} data-testid="confirm-modal-title">
          {title}
        </h3>
        <p className={styles.confirmMessage} data-testid="confirm-modal-message">
          {message}
        </p>
        <div className={styles.confirmActions}>
          <button
            type="button"
            className={styles.btnGhost}
            data-testid="confirm-modal-cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            data-testid="confirm-modal-confirm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );

  if (typeof document === "undefined") {
    return content;
  }
  return createPortal(content, document.body);
}

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./app-shell.module.css";
import { SchedulerHeartbeat } from "./scheduler-heartbeat";

type AppNavKey = "digest" | "session" | "memory" | "settings";

interface AppShellProps {
  active: AppNavKey;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

const NAV_ITEMS: Array<{ key: AppNavKey; label: string; href: string }> = [
  { key: "digest", label: "日报处置", href: "/app/digest" },
  { key: "session", label: "学习会话", href: "/app/session" },
  { key: "memory", label: "记忆库", href: "/app/cards" },
  { key: "settings", label: "设置", href: "/app/settings" }
];

const SHELL_META = ["Wireframe UI", "主链路在线"] as const;

export function AppShell({ active, title, subtitle, children }: AppShellProps) {
  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <aside className={styles.sidebar}>
          <p className={styles.brand}>FOMO Firewall</p>
          <nav className={styles.nav}>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`${styles.navItem} ${active === item.key ? styles.navItemActive : ""}`}
                data-testid={`nav-${item.key}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <p className={styles.note}>一次只聚焦一个页面状态，保持轻量与连续体验。</p>
        </aside>

        <section className={styles.content}>
          <header className={styles.topbar}>
            <div className={styles.topbarMain}>
              <h1>{title}</h1>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            <div className={styles.topMeta} data-testid="shell-top-meta">
              {SHELL_META.map((item) => (
                <span key={item} className={styles.metaPill}>
                  {item}
                </span>
              ))}
            </div>
          </header>

          <div className={styles.body}>{children}</div>
        </section>
      </div>
      <SchedulerHeartbeat />
    </main>
  );
}

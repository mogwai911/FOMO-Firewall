import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  FRAME_SECTION_ORDER,
  GLOBAL_NAV_ITEMS,
  PROTOTYPE_FRAMES,
  type FrameSection
} from "@/lib/prototype/frame-registry";
import styles from "./page.module.css";

type NavItem = (typeof GLOBAL_NAV_ITEMS)[number];

interface HotspotCallout {
  text: string;
  style: CSSProperties;
}

interface SignalCardProps {
  title: string;
  source: string;
  time: string;
  summary: string;
  recommendation: string;
  userChoice?: string;
  pending?: boolean;
  ctaLabel?: string;
  subtleCta?: boolean;
}

const GROUP_LABELS: Record<FrameSection, string> = {
  "app-shell": "AppShell",
  digest: "Digest",
  sources: "Sources",
  session: "Session",
  cards: "Cards",
  evidence: "Evidence"
};

const GROUP_NOTES: Record<FrameSection, string> = {
  "app-shell": "统一框架帧：所有页面共用同一套导航与顶部信息栏。",
  digest: "Digest-Frame1/2/3：列表态、右侧抽屉展开态、DO 后 Session Gate。",
  sources: "Sources-Frame1/2：空态 + 列表态。",
  session: "Session-FrameS1/S2/S3/S4：初始、对话中、异步 queued/running、done + 退出暂停。",
  cards: "Cards-FrameC1/C2/C3/C4：划卡正反面、卡库、详情回溯。",
  evidence: "Evidence-FrameE1/E2：默认折叠 + 展开全量对话。"
};

export default function PrototypePage() {
  const groupedFrames = FRAME_SECTION_ORDER.map((section) => ({
    section,
    frames: PROTOTYPE_FRAMES.filter((frame) => frame.section === section)
  })).filter((group) => group.frames.length > 0);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>Prototype Showroom v2</p>
        <h1>/prototype 低保真线框评审版</h1>
        <p>
          保持原有帧覆盖不变。每帧均为完整屏幕线框（含 App Shell），并使用小号 callout 标注关键交互热点。
        </p>
        <nav className={styles.anchorNav}>
          {groupedFrames.map((group) => (
            <Link key={group.section} href={`#group-${group.section}`}>
              {GROUP_LABELS[group.section]}
            </Link>
          ))}
        </nav>
      </header>

      <div className={styles.groups}>
        {groupedFrames.map((group) => (
          <section key={group.section} id={`group-${group.section}`} className={styles.groupSection}>
            <header className={styles.groupHeader}>
              <h2>
                {GROUP_LABELS[group.section]} <span>({group.frames.length} 帧)</span>
              </h2>
              <p>{GROUP_NOTES[group.section]}</p>
            </header>

            <div className={styles.groupFrames}>
              {group.frames.map((frame) => (
                <WireframeFrame
                  key={frame.id}
                  frameId={frame.id}
                  summary={frame.summary}
                  activeNav={resolveActiveNav(group.section)}
                  callouts={frameCallouts(frame.id)}
                >
                  {renderFrameContent(frame.id)}
                </WireframeFrame>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function WireframeFrame({
  frameId,
  summary,
  activeNav,
  callouts,
  children
}: {
  frameId: string;
  summary: string;
  activeNav: NavItem | null;
  callouts: HotspotCallout[];
  children: ReactNode;
}) {
  return (
    <article className={styles.frameCard} id={frameId} data-frame-id={frameId}>
      <header className={styles.frameHeader}>
        <h3>{frameId}</h3>
        <p>{summary}</p>
      </header>

      <div className={styles.wireframeScreen} data-wireframe-screen="true">
        <div className={styles.appShell} data-app-shell="true">
          <aside className={styles.leftRail}>
            <p className={styles.brand}>FOMO Firewall</p>
            <nav className={styles.navList}>
              {GLOBAL_NAV_ITEMS.map((item) => (
                <button
                  key={`${frameId}-${item}`}
                  type="button"
                  className={`${styles.navButton} ${activeNav === item ? styles.navButtonActive : ""}`}
                >
                  {item}
                </button>
              ))}
            </nav>
            <p className={styles.railHint}>Signal Detail 仅抽屉/展开，不单独路由</p>
          </aside>

          <section className={styles.screenMain}>
            <div className={styles.topBar}>
              <div className={styles.topMeta}>
                <span className={styles.metaBox}>Frame: {frameId}</span>
                <span className={styles.metaBox}>Prototype</span>
              </div>
              <div className={styles.topMeta}>
                <span className={styles.metaBox}>Job 2</span>
                <span className={styles.metaBox}>Toast slot</span>
              </div>
            </div>

            <div className={styles.screenBody}>{children}</div>
          </section>
        </div>

        {callouts.map((callout) => (
          <div
            key={`${frameId}-${callout.text}`}
            className={styles.callout}
            data-callout="true"
            style={callout.style}
          >
            {callout.text}
          </div>
        ))}
      </div>
    </article>
  );
}

function resolveActiveNav(section: FrameSection): NavItem | null {
  if (section === "sources") return "Sources";
  if (section === "cards" || section === "evidence") return "Memory Cards";
  if (section === "digest" || section === "session") return "Digest";
  return null;
}

function frameCallouts(frameId: string): HotspotCallout[] {
  switch (frameId) {
    case "AppShell-FrameA1":
      return [
        {
          text: "固定 3 项顶层导航",
          style: { top: "10%", right: "2%", width: "150px" }
        },
        {
          text: "所有 Frame 共用这一套 App Shell",
          style: { bottom: "10%", right: "2%", width: "180px" }
        }
      ];
    case "Digest-Frame1":
      return [
        {
          text: "同屏并存：triage 未生成 + 已生成",
          style: { top: "9%", right: "2%", width: "180px" }
        }
      ];
    case "Digest-Frame2":
      return [
        {
          text: "右侧抽屉固定字段顺序",
          style: { top: "14%", right: "2%", width: "160px" }
        },
        {
          text: "抽屉底部动作按钮持续可见，可改判",
          style: { bottom: "12%", right: "2%", width: "180px" }
        }
      ];
    case "Digest-Frame3":
      return [
        {
          text: "点击 DO 后出现 CTA",
          style: { top: "22%", right: "2%", width: "150px" }
        },
        {
          text: "不强制跳转，由用户点击进入/继续",
          style: { top: "50%", right: "2%", width: "170px" }
        }
      ];
    case "Sources-Frame1":
      return [
        {
          text: "空态引导：添加 RSS 源开始使用",
          style: { top: "26%", right: "2%", width: "170px" }
        }
      ];
    case "Sources-Frame2":
      return [
        {
          text: "每项支持启用/禁用 + 删除",
          style: { top: "18%", right: "2%", width: "160px" }
        }
      ];
    case "Session-FrameS1":
      return [
        {
          text: "问题卡 3-5 个，可点选发送",
          style: { top: "17%", right: "2%", width: "170px" }
        }
      ];
    case "Session-FrameS2":
      return [
        {
          text: "对话进行中，生成区仍可点",
          style: { top: "14%", right: "2%", width: "160px" }
        }
      ];
    case "Session-FrameS3":
      return [
        {
          text: "queued/running 不阻塞聊天",
          style: { top: "19%", right: "2%", width: "165px" }
        }
      ];
    case "Session-FrameS4":
      return [
        {
          text: "退出=paused，自动保存",
          style: { top: "14%", right: "2%", width: "150px" }
        }
      ];
    case "Cards-FrameC1":
      return [
        {
          text: "划卡正面：Question",
          style: { top: "20%", right: "2%", width: "140px" }
        }
      ];
    case "Cards-FrameC2":
      return [
        {
          text: "翻面后显示 Answer",
          style: { top: "20%", right: "2%", width: "140px" }
        }
      ];
    case "Cards-FrameC3":
      return [
        {
          text: "卡片库搜索 + 列表",
          style: { top: "13%", right: "2%", width: "140px" }
        }
      ];
    case "Cards-FrameC4":
      return [
        {
          text: "回溯入口：Session / Evidence",
          style: { top: "40%", right: "2%", width: "170px" }
        }
      ];
    case "Evidence-FrameE1":
      return [
        {
          text: "默认折叠全量对话",
          style: { top: "53%", right: "2%", width: "140px" }
        }
      ];
    case "Evidence-FrameE2":
      return [
        {
          text: "继续聊（回到 Session）",
          style: { bottom: "10%", right: "2%", width: "145px" }
        }
      ];
    default:
      return [
        {
          text: "交互热点标注",
          style: { top: "10%", right: "2%", width: "120px" }
        }
      ];
  }
}

function renderFrameContent(frameId: string): ReactNode {
  switch (frameId) {
    case "AppShell-FrameA1":
      return (
        <div className={styles.stack}>
          <div className={styles.toolbarRow}>
            <span className={`${styles.tab} ${styles.tabActive}`}>Digest</span>
            <span className={styles.tab}>Sources</span>
            <span className={styles.tab}>Memory Cards</span>
          </div>
          <div className={styles.placeholderGrid}>
            <div className={styles.placeholderPanel}>Content Region A</div>
            <div className={styles.placeholderPanel}>Content Region B</div>
            <div className={styles.placeholderPanel}>Toast / Badge Region</div>
          </div>
        </div>
      );

    case "Digest-Frame1":
      return (
        <div className={styles.stack}>
          <div className={styles.toolbarRow}>
            <span className={`${styles.tab} ${styles.tabActive}`}>待处置</span>
            <span className={styles.tab}>已处理</span>
          </div>
          <div className={styles.cardList}>
            <SignalCard
              title="OpenAI 发布模型更新简报"
              source="OpenAI Blog"
              time="09:10"
              summary="摘要：新增推理能力与 API 调整说明。"
              recommendation="生成建议中..."
              pending
            />
            <SignalCard
              title="Next.js 新版本发布"
              source="Vercel"
              time="09:45"
              summary="摘要：路由与构建体验有小幅更新。"
              recommendation="DO"
              userChoice="未处理"
            />
            <SignalCard
              title="某自媒体转载行业观点"
              source="RSS Mirror"
              time="10:02"
              summary="摘要：无新增数据，主要是二次整理。"
              recommendation="FYI"
              userChoice="DROP"
            />
          </div>
          <div className={styles.systemStateRow}>
            <span className={styles.stateChip}>digest-empty: 今天没有新的线索</span>
            <span className={styles.stateChip}>triage-failed: 建议失败但可手动 FYI/DO/DROP</span>
          </div>
        </div>
      );

    case "Digest-Frame2":
      return (
        <div className={styles.splitLayout}>
          <div className={styles.cardList}>
            <SignalCard
              title="AI Infra 成本优化实践"
              source="Tech Weekly"
              time="11:20"
              summary="摘要：给出成本曲线与迁移策略。"
              recommendation="DO"
              userChoice="FYI"
            />
            <SignalCard
              title="数据库索引策略复盘"
              source="Engineering Notes"
              time="11:55"
              summary="摘要：含具体指标变化与回滚方案。"
              recommendation="DO"
              userChoice="未处理"
            />
          </div>

          <aside className={styles.drawer}>
            <h4>headline</h4>
            <p className={styles.drawerText}>建议 DO：含可执行参数，且与你当前项目直接相关。</p>

            <h4>reasons (&lt;=3)</h4>
            <ul>
              <li>来源可信，包含原始指标截图</li>
              <li>可验证，给出版本号与复现步骤</li>
              <li>信息密度高，包含清晰对比</li>
            </ul>

            <h4>snippets (&lt;=2)</h4>
            <blockquote>“p95 从 420ms 降至 260ms，样本量 50k 请求。”</blockquote>
            <blockquote>“迁移分三步，均可回滚。”</blockquote>

            <h4>next_action_hint</h4>
            <p className={styles.drawerText}>建议进入 Session，用问题卡快速确认适配边界。</p>

            <div className={styles.drawerActions}>
              <button type="button" className={styles.actionBtn}>
                FYI
              </button>
              <button type="button" className={styles.actionBtn}>
                DO
              </button>
              <button type="button" className={styles.actionBtn}>
                DROP
              </button>
            </div>
          </aside>
        </div>
      );

    case "Digest-Frame3":
      return (
        <div className={styles.cardList}>
          <SignalCard
            title="向量检索参数优化"
            source="Research Feed"
            time="12:05"
            summary="摘要：命中率提升方案，含参数建议。"
            recommendation="DO"
            userChoice="DO"
            ctaLabel="进入学习会话"
          />
          <SignalCard
            title="会话中断后的恢复学习"
            source="Internal Notes"
            time="12:22"
            summary="摘要：上次会话已暂停，可继续。"
            recommendation="DO"
            userChoice="DO"
            ctaLabel="继续学习"
            subtleCta
          />
        </div>
      );

    case "Sources-Frame1":
      return (
        <div className={styles.stack}>
          <section className={styles.panel}>
            <h4>添加 RSS</h4>
            <div className={styles.formGrid}>
              <div className={styles.fieldBox}>RSS URL</div>
              <div className={styles.fieldBox}>显示名称（可选）</div>
              <div className={styles.fieldBox}>标签（可选）</div>
              <button type="button" className={styles.actionBtn}>
                添加
              </button>
            </div>
          </section>

          <section className={styles.emptyBlock}>添加 RSS 源开始使用</section>
        </div>
      );

    case "Sources-Frame2":
      return (
        <div className={styles.stack}>
          <section className={styles.panel}>
            <h4>订阅源列表</h4>
            <ul className={styles.sourceList}>
              <li>
                <div>
                  <strong>OpenAI Blog</strong>
                  <p>https://openai.com/blog/rss.xml</p>
                </div>
                <span className={`${styles.toggle} ${styles.toggleOn}`}>enabled</span>
                <button type="button" className={styles.linkBtn}>
                  删除
                </button>
              </li>
              <li>
                <div>
                  <strong>Engineering Weekly</strong>
                  <p>https://example.com/weekly.xml</p>
                </div>
                <span className={styles.toggle}>disabled</span>
                <button type="button" className={styles.linkBtn}>
                  删除
                </button>
              </li>
            </ul>
          </section>
          <div className={styles.systemStateRow}>
            <span className={styles.stateChip}>toast: 已添加订阅源</span>
          </div>
        </div>
      );

    case "Session-FrameS1":
      return (
        <div className={styles.sessionLayout}>
          <section className={styles.sessionMain}>
            <header className={styles.sessionHeader}>
              <div>
                <h4>Signal: Next.js 新特性解读</h4>
                <p>Vercel · 09:45</p>
              </div>
              <div className={styles.inlineButtons}>
                <button type="button" className={styles.linkBtn}>
                  打开原文
                </button>
                <button type="button" className={styles.linkBtn}>
                  返回日报
                </button>
              </div>
            </header>

            <section className={styles.panel}>
              <h4>建议你可以问：</h4>
              <div className={styles.questionRow}>
                <span className={styles.questionChip}>这个变更影响哪些路由行为？</span>
                <span className={styles.questionChip}>我应该先验证哪一步？</span>
                <span className={styles.questionChip}>和当前项目兼容吗？</span>
                <span className={styles.questionChip}>最小实验怎么做？</span>
              </div>
            </section>

            <section className={styles.chatThread}>
              <div className={styles.systemNote}>欢迎进入学习会话，可直接提问。消息自动保存。</div>
              <div className={styles.composer}>输入问题... [发送]</div>
            </section>
          </section>

          <aside className={styles.jobPanel}>
            <h4>生成区</h4>
            <div className={styles.jobRow}>
              <button type="button" className={styles.actionBtn}>
                生成闪卡（后台）
              </button>
              <span className={styles.jobBadge}>idle</span>
            </div>
            <div className={styles.jobRow}>
              <button type="button" className={styles.actionBtn}>
                生成证据包（后台）
              </button>
              <span className={styles.jobBadge}>idle</span>
            </div>
          </aside>
        </div>
      );

    case "Session-FrameS2":
      return (
        <div className={styles.sessionLayout}>
          <section className={styles.sessionMain}>
            <header className={styles.sessionHeader}>
              <div>
                <h4>Signal: Next.js 新特性解读</h4>
                <p>会话中 · 自动保存中</p>
              </div>
              <div className={styles.inlineButtons}>
                <button type="button" className={styles.linkBtn}>
                  打开原文
                </button>
                <button type="button" className={styles.linkBtn}>
                  返回日报
                </button>
              </div>
            </header>

            <section className={styles.chatThread}>
              <div className={styles.bubbleUser}>Q1: 这个更新与现有 App Router 冲突吗？</div>
              <div className={styles.bubbleAssistant}>A1: 主流程兼容，先检查动态段缓存策略。</div>
              <div className={styles.bubbleUser}>Q2: 我应该先改哪里验证？</div>
              <div className={styles.bubbleAssistant}>A2: 先做一个最小路由实验，再比较构建输出。</div>
              <div className={styles.composer}>继续追问... [发送]</div>
            </section>
          </section>

          <aside className={styles.jobPanel}>
            <h4>生成区</h4>
            <div className={styles.jobRow}>
              <button type="button" className={styles.actionBtn}>
                生成闪卡（后台）
              </button>
              <span className={styles.jobBadge}>idle</span>
            </div>
            <div className={styles.jobRow}>
              <button type="button" className={styles.actionBtn}>
                生成证据包（后台）
              </button>
              <span className={styles.jobBadge}>idle</span>
            </div>
          </aside>
        </div>
      );

    case "Session-FrameS3":
      return (
        <div className={styles.sessionLayout}>
          <section className={styles.sessionMain}>
            <header className={styles.sessionHeader}>
              <div>
                <h4>Signal: Next.js 新特性解读</h4>
                <p>会话中 · 可继续聊天</p>
              </div>
              <div className={styles.inlineButtons}>
                <button type="button" className={styles.linkBtn}>
                  返回日报
                </button>
              </div>
            </header>

            <section className={styles.chatThread}>
              <div className={styles.bubbleUser}>请把这个变更拆成 3 个验证步骤。</div>
              <div className={styles.bubbleAssistant}>好的，我先给你最小实验路径。</div>
              <div className={styles.composer}>继续输入... [发送]</div>
            </section>
          </section>

          <aside className={styles.jobPanel}>
            <h4>生成区</h4>
            <div className={styles.jobRow}>
              <button type="button" className={styles.actionBtn}>
                生成闪卡（后台）
              </button>
              <span className={styles.jobBadge}>queued/running</span>
            </div>
            <div className={styles.jobRow}>
              <button type="button" className={styles.actionBtn}>
                生成证据包（后台）
              </button>
              <span className={styles.jobBadge}>queued</span>
            </div>
          </aside>
        </div>
      );

    case "Session-FrameS4":
      return (
        <div className={styles.sessionLayout}>
          <section className={styles.sessionMain}>
            <header className={styles.sessionHeader}>
              <div>
                <h4>Signal: Next.js 新特性解读</h4>
                <p>会话已保存，可随时继续</p>
              </div>
              <div className={styles.inlineButtons}>
                <button type="button" className={styles.linkBtn}>
                  返回日报
                </button>
              </div>
            </header>

            <section className={styles.panel}>
              <p className={styles.systemNote}>toast: 会话已保存，可随时继续（session 状态变为 paused）。</p>
              <p className={styles.systemNote}>返回 Digest 后，对应卡片会显示“继续学习”。</p>
            </section>
          </section>

          <aside className={styles.jobPanel}>
            <h4>生成区</h4>
            <div className={styles.jobRow}>
              <button type="button" className={styles.actionBtn}>
                查看闪卡
              </button>
              <span className={styles.jobBadge}>done</span>
            </div>
            <div className={styles.jobRow}>
              <button type="button" className={styles.actionBtn}>
                查看证据包
              </button>
              <span className={styles.jobBadge}>done</span>
            </div>
          </aside>
        </div>
      );

    case "Cards-FrameC1":
      return (
        <div className={styles.stack}>
          <div className={styles.toolbarRow}>
            <span className={`${styles.tab} ${styles.tabActive}`}>Review</span>
            <span className={styles.tab}>Library</span>
          </div>
          <section className={styles.reviewCard}>
            <h4>Front · Question</h4>
            <p>Q: 为什么这个变更值得进入 Session 深挖？</p>
            <p className={styles.systemNote}>source: Vercel</p>
          </section>
          <div className={styles.controlsRow}>
            <button type="button" className={styles.actionBtn}>
              翻面
            </button>
            <button type="button" className={styles.actionBtn}>
              下一张
            </button>
            <button type="button" className={styles.actionBtn}>
              标记熟悉
            </button>
          </div>
        </div>
      );

    case "Cards-FrameC2":
      return (
        <div className={styles.stack}>
          <div className={styles.toolbarRow}>
            <span className={`${styles.tab} ${styles.tabActive}`}>Review</span>
            <span className={styles.tab}>Library</span>
          </div>
          <section className={`${styles.reviewCard} ${styles.reviewCardBack}`}>
            <h4>Back · Answer</h4>
            <p>A: 因为它提供了可验证参数和明确迁移步骤，可直接转成行动实验。</p>
          </section>
          <div className={styles.controlsRow}>
            <button type="button" className={styles.actionBtn}>
              翻回正面
            </button>
            <button type="button" className={styles.actionBtn}>
              下一张
            </button>
            <button type="button" className={styles.actionBtn}>
              标记熟悉
            </button>
          </div>
        </div>
      );

    case "Cards-FrameC3":
      return (
        <div className={styles.stack}>
          <div className={styles.toolbarRow}>
            <span className={styles.tab}>Review</span>
            <span className={`${styles.tab} ${styles.tabActive}`}>Library</span>
          </div>
          <section className={styles.panel}>
            <div className={styles.fieldBox}>搜索关键词...</div>
            <ul className={styles.libraryList}>
              <li>
                <strong>Q: 这个策略先验证哪里？</strong>
                <p>source: Engineering Weekly</p>
              </li>
              <li>
                <strong>Q: 哪个指标最关键？</strong>
                <p>source: OpenAI Blog</p>
              </li>
              <li>
                <strong>Q: 回滚条件是什么？</strong>
                <p>source: Internal Notes</p>
              </li>
            </ul>
          </section>
        </div>
      );

    case "Cards-FrameC4":
      return (
        <div className={styles.stack}>
          <section className={styles.panel}>
            <h4>Card Detail</h4>
            <p>Q: 这个策略的最小实验路径？</p>
            <p>A: 先做单路由实验，再看构建和 p95 对比。</p>
            <div className={styles.controlsRow}>
              <button type="button" className={styles.actionBtn}>
                回溯会话（Session）
              </button>
              <button type="button" className={styles.actionBtn}>
                查看证据包（Evidence Pack）
              </button>
            </div>
          </section>
        </div>
      );

    case "Evidence-FrameE1":
      return (
        <div className={styles.stack}>
          <section className={styles.panel}>
            <h4>summary</h4>
            <p>本次会话围绕路由改造展开，核心结论是先做最小实验，再逐步放量。</p>
          </section>
          <section className={styles.panel}>
            <h4>key quotes</h4>
            <blockquote>“先验证边界，再迁移主流量。”</blockquote>
            <blockquote>“指标对比必须包含回滚阈值。”</blockquote>
          </section>
          <section className={styles.panel}>
            <h4>links</h4>
            <ul className={styles.linksList}>
              <li>https://example.com/report-1</li>
              <li>https://example.com/benchmark</li>
            </ul>
          </section>
          <section className={styles.collapsedBox}>展开全量对话</section>
        </div>
      );

    case "Evidence-FrameE2":
      return (
        <div className={styles.stack}>
          <section className={styles.panel}>
            <h4>summary / key quotes / links</h4>
            <p>与 E1 相同，略。</p>
          </section>
          <section className={styles.panel}>
            <h4>全量对话（展开）</h4>
            <ul className={styles.transcriptList}>
              <li>user: 这个改造先做哪一步？</li>
              <li>assistant: 先做单路由实验并记录指标。</li>
              <li>user: done 后我应该看哪里？</li>
              <li>assistant: 去 Memory Cards 复习并回溯会话。</li>
            </ul>
          </section>
          <div className={styles.controlsRow}>
            <button type="button" className={styles.actionBtn}>
              继续聊（回到 Session）
            </button>
          </div>
        </div>
      );

    default:
      return <div className={styles.placeholderPanel}>Frame data missing</div>;
  }
}

function SignalCard({
  title,
  source,
  time,
  summary,
  recommendation,
  userChoice,
  pending,
  ctaLabel,
  subtleCta
}: SignalCardProps) {
  return (
    <article className={styles.signalCard}>
      <div className={styles.signalMain}>
        <h4>{title}</h4>
        <p>{source + " · " + time}</p>
        <p>{summary}</p>
      </div>

      <div className={styles.signalRail}>
        <div className={styles.badgeRow}>
          <span className={`${styles.badge} ${pending ? styles.badgePending : ""}`}>建议：{recommendation}</span>
          <span className={styles.badgeStrong}>你已选：{userChoice ?? "未处理"}</span>
        </div>

        <div className={styles.cardActions}>
          <button type="button" className={styles.actionBtn}>
            FYI
          </button>
          <button type="button" className={styles.actionBtn}>
            DO
          </button>
          <button type="button" className={styles.actionBtn}>
            DROP
          </button>
        </div>

        {ctaLabel ? (
          <button type="button" className={`${styles.ctaBtn} ${subtleCta ? styles.ctaBtnSubtle : ""}`}>
            {ctaLabel}
          </button>
        ) : null}
      </div>
    </article>
  );
}

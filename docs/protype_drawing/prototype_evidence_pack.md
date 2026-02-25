# prototype_evidence_pack.md — Evidence Pack（证据包）原型规格（Web Demo / MVP）

> 更新时间：2026-02-20  
> 对齐：PRD v2 + IA v1  
> 目标：低频回看“依据与思维链”：摘要 + 关键引用 + 链接；全量对话默认折叠。

---

## 0) 页面定位与原则
- Evidence Pack 是 **低频**：当用户想回顾为何得出结论、或需要引用时才打开。
- 默认展示“可读摘要”，全量对话默认折叠，避免信息轰炸。

---

## 1) 页面布局

### A) 顶部信息栏
必须包含：
- 标题：`证据包`
- 关联线索标题（可截断）
- 来源/时间（可选）
- 跳转：`回到会话（继续聊）`

### B) Summary（摘要）
必须包含：
- pack.summary（2–6 行）
-（可选）一行提示：`这是对本次学习过程的摘要，可展开查看全量对话。`

### C) Key Quotes（关键引用）
必须包含：
- 1–3 条引用块（pack.key_quotes）
- 标注来源：`rss` / `conversation`

### D) Links（链接）
必须包含：
- 1–5 个链接（pack.links）
- 链接旁可显示域名（可选）

### E) Full Conversation（全量对话，折叠）
必须包含：
- 折叠标题：`展开全量对话`
- 展开后显示若干消息片段（来自 SessionMessage）
-（可选）只展示最近 N 条，并提供“加载更多”

---

## 2) 关键交互
- 点击 `回到会话（继续聊）` → 打开 Session（恢复）
- 展开/收起全量对话（默认收起）
- 若 Evidence Pack 尚未生成：
  - 显示状态：`生成中…` 或 `未生成`
  - 提示操作：`回到会话生成证据包`

---

## 3) 状态机
- `loading`
- `ready`
- `generating`（job queued/running）
- `failed`（显示失败与重试入口：回到会话重试）

---

## 4) 必须绘制的原型帧（Codex）
- Frame E1：详情页默认态（Summary + Quotes + Links + 折叠的全量对话）
- Frame E2：展开全量对话态（显示对话片段 + 回到会话）
-（可选）Frame E3：generating/未生成态

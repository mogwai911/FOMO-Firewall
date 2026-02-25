# prototype_session.md — Session（学习会话页）原型规格（Web Demo / MVP）

> 更新时间：2026-02-20  
> 对齐：PRD v2 + IA v1  
> 目标：把 DO 线索转为“可随时退出/可恢复”的学习对话，并支持**异步生成**闪卡/证据包（不阻塞继续学习下一个 feed）。

---

## 0) 页面定位与原则

### 页面定位
- Session 是围绕 **单条 Signal（线索）** 的学习对话页。
- 入口：仅来自 Digest（当用户选择 DO）或从 Memory Cards/Evidence Pack 回溯打开。
- 退出：返回 Digest；退出只是 **paused（暂存）**，不等于完成。

### 核心原则（MVP 必须满足）
1) **默认保存全量对话日志**：消息发送即持久化（SessionMessage）。
2) **退出即暂存**：用户可以随时退出；下次进入可恢复上下文继续聊。
3) **异步生成**：闪卡/证据包生成必须走 Job（queued/running/done/failed），不能阻塞对话。
4) **用户可不生成任何沉淀**：即使没点生成，日志也已保存；后续仍可生成。

---

## 1) 页面布局（建议 3 区）

### A. 顶部信息栏（Signal Header）
必须包含：
- 标题（signal.title，1–2 行截断）
- 来源（source.name）+ 时间（published_at）
- 原文链接（Open original，新开 tab）
- 返回/退出按钮：`返回日报`（Exit）

可选：
- 当前处置标签显示：`你已选：DO`（只读提示）
- Session 状态（小字）：`已自动保存` / `上次更新：xx`

---

### B. 问题卡区（Question Cards）
目的：降低用户开口成本（但不强制）。

必须包含：
- 区域标题：`建议你可以问：`
- 3–5 个问题卡（chip/card 形式）
  - 点击即把问题填入输入框或直接发送一条 user 消息（选其一，推荐：直接发送）
- 一个轻入口：`不想用问题卡，我自己问`（其实就是默认输入框）

问题卡生成时机：
- Session 初次进入时，可由 Agent 生成（同步或预取）。
- 若生成失败，显示占位：`问题卡生成失败，你可以直接提问。`

---

### C. 对话区（Chat）
必须包含：
- 消息列表（assistant/user）
- 输入框 + 发送按钮
- “正在回复”loading 状态
-（可选）系统提示：`消息将自动保存`

交互规则（MVP）：
- 发送消息后立刻写入 SessionMessage（user）
- assistant 回复返回后写入 SessionMessage（assistant）
- 不依赖“完成/保存”按钮；保存是自动的

---

### D. 生成区（Asynchronous Generation Panel）
目的：在不打断对话的情况下触发沉淀任务。

必须包含两个按钮（可放右侧栏或对话区下方）：
- `生成闪卡（后台）`
- `生成证据包（后台）`

每个按钮旁需要显示 Job 状态：
- idle（未触发）
- queued
- running
- done（并给一个入口：`查看闪卡` / `查看证据包`）
- failed（显示“失败”与 `重试`）

交互规则：
- 点击按钮 → 立即创建 Job（写入 Job 表）→ UI 切到 queued/running
- 用户可以继续聊天；生成区只作为侧边状态，不弹阻塞窗
- Job done 后展示轻提示（toast）：`闪卡已生成` / `证据包已生成`

---

## 2) 关键交互（必须画出来）

### 2.1 进入 Session（从 Digest）
- 条件：用户在 Digest 对某条 signal 选择 DO
- 行为：
  - 若该 signal 没有 session：创建 session（status=active）
  - 若已有 paused session：恢复（status=active）
- UI：Header 显示 signal 信息，聊天区展示历史消息（若有）

### 2.2 退出 Session（返回 Digest）
- 点击 `返回日报`
- 行为：
  - session.status -> paused
  - 不询问“是否保存”，因为自动保存
- UI：
  - 可显示轻提示 toast：`会话已保存，可随时继续`
  - 返回 Digest 后，该 signal 卡出现入口：`继续学习`

### 2.3 生成闪卡（后台）
- 点击 `生成闪卡（后台）`
- 行为：
  - enqueue FLASHCARDS job
  - 立即显示 queued/running
  - done 后写入 MemoryCard（3–5 张）
- UI：
  - done 后按钮变为：`查看闪卡` 或保持按钮并显示 done 标签
  - 不强制跳转；用户可继续聊天

### 2.4 生成证据包（后台）
- 点击 `生成证据包（后台）`
- 行为：
  - enqueue EVIDENCE_PACK job
  - done 后写入 EvidencePack（摘要 + 引用 + links），全量对话仍在 SessionMessage
- UI：
  - done 后出现：`查看证据包`
  - 不强制跳转

---

## 3) 状态机（Session 页必须覆盖的状态）

### 3.1 Session 状态
- `active`：正在会话中
- `paused`：用户退出后暂存（再次打开恢复）
- `closed`：MVP 可不实现（预留）

### 3.2 Questions 状态
- `loading`：生成中（可选）
- `ready`：已有 3–5 个问题卡
- `failed`：失败提示 + 允许用户直接问

### 3.3 Chat 状态
- `idle`
- `sending`（消息已发出）
- `assistant_typing`（等待回复）
- `error`（显示错误提示，允许重发）

### 3.4 Job 状态（两类）
- `idle`（未触发）
- `queued`
- `running`
- `done`
- `failed`（提供重试）

---

## 4) UI 组件清单（便于实现与对齐）
- SignalHeader（Title / SourceMeta / OpenOriginalLink / ExitButton）
- QuestionCardList（QuestionCardItem * 3–5）
- ChatThread（MessageBubble / Composer / LoadingIndicator）
- GenerationPanel（FlashcardsButton+JobBadge / EvidenceButton+JobBadge / ViewResultLinks）
- Toast/Notifications（Job 创建/完成/失败；Session 已保存）

---

## 5) 文案骨架（MVP 建议）
- 返回按钮：`返回日报`
- 原文：`打开原文`
- 问题卡区标题：`建议你可以问：`
- 生成区按钮：`生成闪卡（后台）` / `生成证据包（后台）`
- 状态：`排队中… / 生成中… / 已完成 / 失败（重试）`
- 退出 toast：`会话已保存，可随时继续。`
- 完成 toast：`闪卡已生成（可在记忆卡中复习）` / `证据包已生成（可回看依据）`

---

## 6) 必须绘制的原型帧（Codex 交付要求）
- **Frame S1：初始进入（无历史）**
- **Frame S2：对话进行中（至少 2 轮消息）**
- **Frame S3：点击生成闪卡后的异步状态（queued/running，不阻塞继续聊天）**
- **Frame S4：退出会话（返回 Digest，提示已保存；Digest 对应卡出现“继续学习”入口）**

可选增强帧：
- Frame S5：Job done（出现“查看闪卡/查看证据包”入口）
- Frame S6：Job failed（显示失败与重试）

---

## 7) 数据/事件对齐（供工程参考）
EventLog：
- ENTER_SESSION / EXIT_SESSION / SESSION_RESUME
- JOB_REQUESTED_FLASHCARDS / JOB_REQUESTED_EVIDENCE_PACK
- JOB_DONE_* / JOB_FAILED_*

存储：
- Session / SessionMessage：全量对话
- Job：异步任务
- MemoryCard：闪卡结果
- EvidencePack：证据包摘要（全量对话回溯 SessionMessage）

---

## 8) MVP 取舍（明确不做）
- 不做“学习完成/Completed”按钮
- 不做 Beginner/Advanced 任务包分流
- 不在 UI 暴露 tool traces（只保留证据包摘要 + 可展开对话）

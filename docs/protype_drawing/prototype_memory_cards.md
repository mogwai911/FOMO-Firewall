# prototype_memory_cards.md — Memory Cards（记忆卡）原型规格（Web Demo / MVP）

> 更新时间：2026-02-20  
> 对齐：PRD v2 + IA v1  
> 目标：用“像背单词一样”的方式高频复习学习结果；同时支持回溯会话与证据包（低频）。

---

## 0) 页面定位与原则

### 页面定位
- Memory Cards 是 **学习结果层（高频）**：3–5 张卡片/要点来自某条 Session 的异步生成。
- 用户进入这里的动机是“快速复习”，不是做笔记/建知识库。

### 核心原则（MVP）
1) **默认轻**：不做 Notion/Obsidian 级别编辑器；卡片以只读为主（最多支持收藏/熟悉度）。
2) **高频优先**：第一入口是“划卡复习”，其次才是“卡片库搜索”。
3) **可回溯**：每张卡都能跳回对应 Session；若有 Evidence Pack 也可跳转。

---

## 1) 信息架构（页内结构）

- Memory Cards（顶层入口）
  - Tab A：**复习 Review**（默认）
  - Tab B：**卡片库 Library**

> MVP 建议：用 Tab，不单独多路由；或 `/cards` 下 query param 控制。

---

## 2) 布局与组件

### A) Review（划卡复习）
必须包含：
- 卡片容器（居中）
  - 正面：Question / 要点标题（1–2 行）
  - 背面：Answer / 解释（<=2 句）
- 操作按钮（最小集合）：
  - `翻面`
  - `下一张`
  - `标记熟悉`（或 `我会了`）
  - `收藏`（可选）
- 辅助信息（小字）：
  - 来源（source）
  - 关联线索标题（可截断）
  - 生成时间（可选）

交互规则：
- 默认显示正面；点击翻面显示背面。
- 标记熟悉/收藏写入 EventLog（CARD_REVIEWED/CARD_STARRED），但不需要复杂 SRS 算法（MVP 不做间隔重复）。

---

### B) Library（卡片库）
必须包含：
- 搜索框（关键词）
- 过滤（可选）：来源/标签
- 卡片列表项（每项一行）：
  - question 摘要
  - 来源（灰字）
  -（可选）标签
- 点击进入 Card Detail（抽屉或独立页）

---

### C) Card Detail（卡片详情）
必须包含：
- 完整 Q/A 或要点
- 关联信息：
  - signal 标题（可选）
  - 来源/时间（可选）
- 回溯入口（必须）：
  - `回溯会话（Session）`
  - `查看证据包（Evidence Pack）`（若没有则显示“未生成/去生成”）
- 轻操作（可选）：
  - 收藏/取消收藏
  - 标记熟悉

---

## 3) 关键交互（必须画出来）

### 3.1 从 Session 进入 Memory Cards（生成完成后）
- Job DONE（FLASHCARDS）后：
  - 不强制跳转
  - 通过 toast/角标提示：`闪卡已生成，可在记忆卡中复习`
- 用户从导航进入 `/cards` 默认落在 Review Tab

### 3.2 Review 交互
- 翻面 → 显示答案
- 下一张 → 切换到下一张卡（可以随机/顺序，MVP 随机即可）
- 标记熟悉 → 写事件，简单降低后续出现概率（可选；MVP 可不做概率，只记录）

### 3.3 从卡片回溯 Session/Evidence
- 点击 `回溯会话` → 打开对应 Session（恢复历史）
- 点击 `查看证据包` → 打开 Evidence Pack 详情（若未生成则提示去 Session 生成）

---

## 4) 状态机（MVP 覆盖）

### 4.1 数据状态
- `empty`：无卡片（提示“先从日报选择 DO 并生成闪卡”）
- `loading`：加载中
- `ready`：可复习/可检索

### 4.2 Review 状态
- `front` / `back`（翻面）
- `end_of_deck`（可选：提示“今天复习完成”）

### 4.3 Library 状态
- `no_results`：搜索无结果

---

## 5) UI 组件清单
- CardsTabs（Review / Library）
- ReviewCard（Front/Back）
- ReviewControls（Flip/Next/Familiar/Star）
- SearchBar
- CardsList（ListItem）
- CardDetail（Backlink buttons）

---

## 6) 文案骨架（MVP）
- Review 空态：`还没有闪卡。去日报选择 DO 并在会话中生成闪卡。`
- 翻面：`翻面`
- 熟悉：`我会了`
- 收藏：`收藏`
- 回溯：`回溯会话`
- 证据：`查看证据包`

---

## 7) 必须绘制的原型帧（Codex 交付要求）

### Frame C1：Review（默认入口）
- 一张卡正面 + 控制按钮

### Frame C2：Review（翻面后）
- 同一张卡背面 + 控制按钮

### Frame C3：Library 列表 + 搜索
- 搜索框 + 多条列表项

### Frame C4：Card Detail（含回溯按钮）
- Q/A + 回溯会话 + 查看证据包

（可选）
- Frame C5：空态（无卡片）

---

## 8) MVP 取舍（明确不做）
- 不做复杂间隔重复算法（SRS）
- 不做富文本编辑/双链/知识库结构
- 不做多维表格

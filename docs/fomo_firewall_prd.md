# FOMO Firewall（Web Demo）PRD（中文）

> 目标：给 Codex/工程同学一个**完整视角**的产品定义与系统架构上下文，避免“按步骤做流水线但不知道为什么”。  
> 范围：只做 Web Demo；不做支付、不做宣传投放、不做多端、不做复杂订阅管理。

---

## 1. 背景与问题定义

### 1.1 背景
在 AI 信息环境中，“垃圾但正确”的内容激增：标题制造焦虑、叙事夸张、结论看似合理但缺乏可复用价值。对熟悉行业的人容易辨别，但对多数人会触发 FOMO（Fear of Missing Out）——**不学就落后**的心理压力。

### 1.2 我们解决的核心问题（不是“信息聚合”）
信息聚合只能让你看到更多信息，但 FOMO 的根因是：
- **意义不确定**：这条信息对我的角色/目标是否真的重要？
- **时效不确定**：必须现在看吗？错过成本是什么？
- **行动不确定**：我该做什么才能把信息“消化”成知识或工具？
- **沉淀焦虑**：收藏越多越焦虑，知识库反而变成垃圾场。

因此，本产品的定位不是“推荐阅读”，而是 **FOMO 分诊 + 行动闭环 + 最小沉淀**。

---

## 2. 产品愿景与一句话定义

### 2.1 一句话定义
**粘贴链接 → 得到一张“FOMO 处置单”（解释+建议+一步行动） → 做完一步行动 → 生成可复用的知识卡；否则只留下可回溯索引，不制造收藏垃圾。**

### 2.2 产品价值主张（Web Demo 层面）
- 把“焦虑驱动的阅读”变成“决策驱动的处置”
- 用轻量行动让信息产生复利（做过/产出过才沉淀）
- 让“延后/忽略”变得理性且有正反馈（正念与奖励）

---

## 3. 目标与非目标

### 3.1 目标（MVP）
1) 完整跑通闭环：**Collect → Triage → Act → Deposit → Review**
2) 每条信息都能输出**可解释**处置建议（≤3 条理由）
3) 知识库不变垃圾场：Knowledge Card 必须**行动门禁**
4) 支持角色差异（PM/Eng/Research）带来的“意义映射”

### 3.2 非目标（明确不做）
- 支付/订阅/商业化
- iOS/桌面端
- 大规模爬虫、复杂 RSS 订阅管理 UI（OPML/分类等可后续）
- 复杂知识图谱/本体论（MVP 只做卡片；图谱仅作为可视化视图可选）
- 多人协作、团队空间

---

## 4. 产品整体结构：四大功能模块

> 你提出的四模块：**消息聚合收集 / 分流打分讲解 / 知识库沉淀 / 奖励与正念**  
> 我们将其落地为系统闭环的 5 个阶段：Collect、Triage、Act、Deposit、Review（其中 Reward/Mindfulness 贯穿 Act & Deposit）

### 4.1 模块 A：消息聚合收集（Collect）
**目标：**低成本把外部信息变成系统可处理的“Item”。

**输入（MVP）：**
- 粘贴 URL（主入口）
- 粘贴文本（兜底：付费墙/反爬/无网）

**输出：**
- `Item`：包含 `url/title/author/published_at/extracted_text/created_at`

**关键能力：**
- 抓取网页 HTML
- Readability 正文抽取（尽量把“可读内容”抽出来）
- 存储最小可追溯元数据（来源链接必须保留）

参考项目：
-   [ourongxing/newsnow: Elegant reading of real-time and hottest news](https://github.com/ourongxing/newsnow)
- [sansan0/TrendRadar: ⭐AI-driven public opinion & trend monitor with multi-platform aggregation, RSS, and smart alerts.🎯 告别信息过载，你的 AI 舆情监控助手与热点筛选工具！聚合多平台热点 + RSS 订阅，支持关键词精准筛选。AI 翻译 + AI 分析简报直推手机，也支持接入 MCP 架构，赋能 AI 自然语言对话分析、情感洞察与趋势预测等。支持 Docker ，数据本地/云端自持。集成微信/飞书/钉钉/Telegram/邮件/ntfy/bark/slack 等渠道智能推送。](https://github.com/sansan0/TrendRadar)

---

### 4.2 模块 B：信息分流打分讲解（Triage）
**目标：**对每个 Item 生成一张“FOMO 处置单”，从“值得读吗”升级到“该怎么处置”。

**核心产物：FOMO 处置单（Triage Card）**
要求：**结构化 + 可解释 + 可行动**。

最小字段（MVP 必须包含）：
1) **角色意义映射（Role-fit）**：对 PM/Eng/Research 分别意味着什么（短）
2) **时效性（Time-sensitivity）**：NOW / LATER / IGNORE + “错过成本”解释
3) **可行动性分（Actionability 0–100）**：并给 1 句理由
4) **噪声/夸张分（Hype/Noise 0–100）**：并给 1 句理由（识别“爆打/超越/震撼”等叙事）
5) **推荐处置（Recommended action）**：Read now / Schedule / Ignore / Ask someone
6) **一步行动任务（One-step task）**：15–30 分钟可完成，且有明确 done condition
7) **解释理由（Explainability）**：最多 3 条（避免黑箱）

**交互学习信号（MVP）：**
- 👍 对我更重要
- 👎 对我不重要
- ✅ 我完成了（行动任务）
- ⏰ 7 天后提醒我复盘
偏好存储在 `UserProfile + EventLog`，不要求登录；MVP 采用单用户本地配置。
角色策略优先级：`Settings.role` > 默认角色（ENG）。处置单始终输出三角色映射，但 UI 高亮当前角色。
这些轻交互是偏好学习和闭环复盘的数据来源（不需要用户写长偏好问卷）。

---

### 4.3 模块 C：知识库沉淀（Deposit）
**目标：**“留下去”，但不让用户为了缓解焦虑疯狂收藏。
用3星蓝卡、4星紫卡、5星金卡对知识做分级，索引卡不需要星级分类机制。
#### 核心设计：两类卡片（Minimal Memory）
1) **Index Card（索引卡，默认）**  
用于：记录“我见过它 + 我为何延后/忽略 + 何时再看”。  
特点：轻量、允许随时创建、不制造沉淀压力。

2) **Knowledge Card（知识卡，行动门禁）**  
用于：沉淀真正可复用内容（框架/方法/技巧/可执行模板）。  
门禁：只有用户点 ✅ Completed（完成一步行动）才允许创建。

#### 反垃圾机制（MVP 必须实现）
- **行动门禁**：未 Completed 不允许 Knowledge Card（只能 Index）
- **完成证据**：写入 Completed 事件时需至少一条 evidence（`artifact_link` 或 ≥50 字复盘文本 或 done checklist）
- **可追溯**：卡片必须包含 source url + triage snapshot id + 行为日志引用
- **卡片结构强约束**：控制冗长与泛泛而谈（见 7.2 schema）

（可选 M1：周预算 + 自动降级，但 MVP 可先不做）

---

### 4.4 模块 D：奖励与正念（Reward & Mindfulness）
**目标：**把“理性延后/忽略”与“行动消化”变成正反馈，降低焦虑惯性。

MVP-lite 方案（不做复杂养成）：
- **Calm Point**：用户选择延后/忽略“高噪声内容” +1
- **Growth Point**：用户完成行动并创建 Knowledge Card +2
- 首页每日一句：  
  “今天也学到了很多知识。”
- 积分去重：同一 `item_id` 在同一天对同类积分事件最多记 1 次，避免刷分。

注意：奖励不是目的，是“行为强化”与“正念提示”。

---

## 5. 用户旅程与关键页面（Web Demo）

### 5.1 页面 1：Inbox（首页）
- 输入区：粘贴 URL / 粘贴文本
- Item 列表：显示状态徽标（New/Triaged/Scheduled/Ignored/Completed/Card）
- 右上角：Cat/Points + 今日正念文案

### 5.2 页面 2：Item Detail（信息详情页）
- 来源信息：标题、作者、时间、链接、正文摘要（可折叠）
- Triage Card：处置单（结构化展示）
- 按钮：👍 👎 ✅ ⏰
- 创建卡片按钮：
  - Create Index Card（随时可用）
  - Create Knowledge Card（若未完成则置灰并提示“需先完成一步行动”）

### 5.3 页面 3：Library（知识库）
- Tab：Knowledge Cards / Index Cards
- 搜索：关键词（标题/概念/来源）
- 过滤：角色、日期

### 5.4 页面 4：Review（复盘）
- 列表：⏰ 到期复盘项
- 操作：仍相关/不相关（写入事件日志）
- （可选）重新 triage

### 5.5 页面 5：Settings（设置）
- 角色选择：PM / Eng / Research
- 可选：每日时间预算、讨厌的 hype 词（种子）
- 默认行为：未设置角色时使用 `ENG`

---

## 6. 系统架构规划（Web Demo）

### 6.1 技术栈（建议）
- **Next.js（App Router）+ TypeScript**
- **SQLite + Prisma**
- 正文抽取：`@mozilla/readability`（或同类）
- LLM：任意 Provider（关键是 **严格 JSON 输出 + 服务端校验**）
- 测试：Vitest（unit）+ Playwright（e2e）

### 6.2 分层与职责
- **UI 层（Next.js pages/components）**：展示 Inbox/Detail/Library/Review
- **API/Server Actions 层**：
  - ingestion（抓取+抽取）
  - triage（调用 LLM + schema 校验）
  - event logging（写事件）
  - card creation（门禁+写卡片）
- **数据层（Prisma + SQLite）**：Item/Triage/EventLog/Cards/Profile

### 6.3 核心 API（建议形态）
1) `POST /api/items`  
   输入：`{url?: string, text?: string}`  
   输出：`{itemId}`

2) `POST /api/items/:id/triage`  
   输入：`{role: "PM"|"ENG"|"RES"}`  
   输出：`{triageId, triageJson}`（校验通过后保存）

3) `POST /api/items/:id/events`  
   输入：`{eventType, payload?}`  
   输出：`ok`

4) `POST /api/items/:id/cards/index`  
   输入：`{triageId}`  
   输出：`{indexCardId}`

5) `POST /api/items/:id/cards/knowledge`  
   输入：`{triageId}`  
   逻辑：必须存在 Completed 事件  
   输出：`{knowledgeCardId}`

6) `GET /api/library` / `GET /api/review`

### 6.4 Agent Loop 如何在系统里体现
- “Agent”不等于 while-retry，而是 **系统级闭环**（Collect→Triage→Act→Deposit→Review）
- “记忆”不等于全量聊天记录，而是 **可追溯的结构化存储**
- “偏好”不靠长问卷，而靠轻交互事件流

---

## 7. 数据模型与 Schema（用于 Codex 生成代码）

### 7.1 数据表（最小集合）
- `UserProfile(id, role, timeBudgetMinutes?, createdAt, updatedAt)`
- `Item(id, url?, title?, author?, publishedAt?, extractedText, createdAt)`
- `Triage(id, itemId, role, triageJson, createdAt)`
- `EventLog(id, itemId, eventType, payloadJson?, createdAt)`
- `IndexCard(id, itemId, triageId, contentJson, createdAt)`
- `KnowledgeCard(id, itemId, triageId, contentJson, createdAt)`

### 7.2 Triage Card JSON Schema（必须可校验）
```json
{
  "role_fit": {
    "pm": "string",
    "eng": "string",
    "res": "string"
  },
  "time_sensitivity": {
    "label": "NOW|LATER|IGNORE",
    "miss_cost": "string"
  },
  "scores": {
    "actionability": 0,
    "hype_noise": 0
  },
  "recommended_action": "READ_NOW|SCHEDULE|IGNORE|ASK_SOMEONE",
  "one_step_task": {
    "task": "string",
    "done_definition": "string",
    "estimated_minutes": 0
  },
  "reasons": ["string", "string", "string"],
  "policy_trace": {
    "final_label": "NOW|LATER|IGNORE",
    "rule_id": "R1|R2|R3|FALLBACK",
    "consistency": "PASS|ADJUSTED"
  }
}
```

约束：
- `reasons` 长度 1–3
- 分数 0–100
- `estimated_minutes` 建议 10–45（默认 15–30）
- `reasons` 需覆盖：角色相关性、时效依据、可执行依据（至少各 1 条）

### 7.3 Index Card JSON（轻量索引）
```json
{
  "title": "string",
  "url": "string",
  "one_line_takeaway": "string",
  "why_it_felt_urgent": "string",
  "why_defer_or_ignore": "string",
  "review_trigger": "NONE|IN_7_DAYS|WHEN_NEEDED",
  "trace": {
    "triage_id": "string",
    "item_id": "string"
  }
}
```

### 7.4 Knowledge Card JSON（行动后沉淀）
```json
{
  "title": "string",
  "concepts": ["string", "string"],
  "key_ideas": ["string", "string", "string"],
  "how_to_use": ["string", "string"],
  "boundaries": ["string", "string"],
  "my_artifact": {
    "type": "NOTE|LINK|CODE_SNIPPET|NONE",
    "value": "string"
  },
  "trace": {
    "source_url": "string",
    "triage_id": "string",
    "item_id": "string"
  }
}
```

---

## 8. 核心业务规则（必须明确）

### 8.1 Knowledge Card 门禁规则（反垃圾）
- 创建 Knowledge Card 的前置条件：该 `item_id` 必须存在 `eventType=COMPLETED`
- `eventType=COMPLETED` 必须带 evidence（`artifact_link` 或 `reflection_text>=50` 或 `done_checklist=true`）
- 未满足门禁：UI 置灰 + 提示原因

### 8.2 可解释推荐规则（反黑箱）
- Triage 必须输出 ≤3 条理由
- 处置建议必须对应理由（理由要解释“为什么建议延后/忽略”）
- 理由质量约束：3 条理由至少覆盖角色相关性、时效依据、可执行依据三个维度

### 8.3 可追溯规则（可复盘）
- 卡片必须带 trace（item_id/triage_id/source_url）
- 所有用户行为必须写入 EventLog

### 8.4 分诊护栏裁决层（Policy Guardrail，M0 必须）
- LLM 先输出原始分诊，再由服务端按规则裁决最终 `final_label`
- 规则（默认“平衡”策略）：
  - `R1`: `actionability>=70` 且 `hype_noise<=60` 且 `miss_cost` 为高 -> `NOW`
  - `R2`: `hype_noise>=75` 且 `actionability<=40` -> `IGNORE`
  - `R3`: 其余 -> `LATER`
- 每条处置单需记录 `policy_trace.rule_id` 以支持复盘和调参

### 8.5 评分标尺（防漂移）
- `actionability` 与 `hype_noise` 都使用 5 档锚点：20 / 40 / 60 / 80 / 95
- 每档给出正反例（放在提示词模板中），避免“同分不同义”

### 8.6 处置一致性规则
- `time_sensitivity` 与 `recommended_action` 需满足一致性矩阵：
  - `NOW` -> `READ_NOW|ASK_SOMEONE`
  - `LATER` -> `SCHEDULE|ASK_SOMEONE`
  - `IGNORE` -> `IGNORE`
- 不一致时：优先按 `final_label` 自动修正 `recommended_action`，并标记 `policy_trace.consistency=ADJUSTED`

### 8.7 Ask Someone 完成定义
- 当推荐动作为 `ASK_SOMEONE` 时，必须生成可发送模板：`对象`、`背景`、`问题`、`期望回复`
- 仅当模板已生成并被用户确认发送（或复制）才可记为有效执行

### 8.8 高风险领域安全模式（SAFE_MODE）
- 对医疗/法律/投资等高风险主题触发 SAFE_MODE：
  - 默认 `final_label=LATER`
  - 增加提示“需专业来源二次确认，不构成专业建议”

### 8.9 积分与行为防刷规则
- 积分按 `(item_id, event_type, date)` 去重，同日同项最多记 1 次
- 同一 `item_id` 的 `COMPLETED` 重复提交不重复加分

### 8.10 Review 纠偏闭环（M1）
- 新增事件 `DEFERRED_BUT_IMPORTANT`：用户在复盘时把延后项标记为“其实重要”
- 该事件用于后续阈值调优，避免长期过度延后

### 8.11 M1 预算与自动降级
- 周 Knowledge Card 预算默认 10 张；超额后仅允许创建 Index Card
- 21 天未复习且无引用事件的 Knowledge Card 自动降级为 Index Card（保留 trace）

### 8.12 平衡策略目标分布（M0 观察指标）
- `NOW`: 20–35%
- `LATER`: 40–60%
- `IGNORE`: 15–30%
- 连续 7 天超出区间则触发提示词与阈值复核

### 8.13 护栏实现判定表与伪代码（可直接用于后端）

#### 8.13.1 最终分诊标签判定表（`final_label`）
| 优先级 | 条件 | 输出 `final_label` | `rule_id` |
|---|---|---|---|
| P0 | 高风险领域（医疗/法律/投资） | `LATER` | `SAFE_MODE` |
| P1 | `actionability>=70 && hype_noise<=60 && miss_cost=high` | `NOW` | `R1` |
| P2 | `hype_noise>=75 && actionability<=40` | `IGNORE` | `R2` |
| P3 | 其他情况 | `LATER` | `R3` |

#### 8.13.2 推荐动作一致性映射表
| `final_label` | 允许的 `recommended_action` |
|---|---|
| `NOW` | `READ_NOW` / `ASK_SOMEONE` |
| `LATER` | `SCHEDULE` / `ASK_SOMEONE` |
| `IGNORE` | `IGNORE` |

若 LLM 返回动作不在允许集合，服务端自动修正为默认动作：
- `NOW -> READ_NOW`
- `LATER -> SCHEDULE`
- `IGNORE -> IGNORE`

#### 8.13.3 Knowledge Card 门禁判定表
| 条件 | 是否允许创建 Knowledge Card |
|---|---|
| 无 `COMPLETED` 事件 | 否 |
| 有 `COMPLETED` 但无 evidence | 否 |
| 有 `COMPLETED` 且 evidence 满足其一（`artifact_link` / `reflection_text>=50` / `done_checklist=true`） | 是 |

#### 8.13.4 积分去重判定表
| 事件 | 基础积分 | 去重键 |
|---|---:|---|
| `SCHEDULED` 或 `IGNORED` 且为高噪声 | `+1` Calm | `(item_id, CALM_POINT, date)` |
| `COMPLETED` 且成功创建 Knowledge Card | `+2` Growth | `(item_id, GROWTH_POINT, date)` |

同一去重键重复写入时，积分增量为 `0`。

#### 8.13.5 伪代码（TypeScript 风格）
```ts
type FinalLabel = "NOW" | "LATER" | "IGNORE";
type Action = "READ_NOW" | "SCHEDULE" | "IGNORE" | "ASK_SOMEONE";

function applyPolicyGuardrail(input: {
  actionability: number;
  hypeNoise: number;
  missCost: "low" | "medium" | "high";
  recommendedAction: Action;
  isHighRiskDomain: boolean;
}) {
  let finalLabel: FinalLabel;
  let ruleId: "SAFE_MODE" | "R1" | "R2" | "R3";

  if (input.isHighRiskDomain) {
    finalLabel = "LATER";
    ruleId = "SAFE_MODE";
  } else if (
    input.actionability >= 70 &&
    input.hypeNoise <= 60 &&
    input.missCost === "high"
  ) {
    finalLabel = "NOW";
    ruleId = "R1";
  } else if (input.hypeNoise >= 75 && input.actionability <= 40) {
    finalLabel = "IGNORE";
    ruleId = "R2";
  } else {
    finalLabel = "LATER";
    ruleId = "R3";
  }

  const allowed: Record<FinalLabel, Action[]> = {
    NOW: ["READ_NOW", "ASK_SOMEONE"],
    LATER: ["SCHEDULE", "ASK_SOMEONE"],
    IGNORE: ["IGNORE"]
  };

  const defaultAction: Record<FinalLabel, Action> = {
    NOW: "READ_NOW",
    LATER: "SCHEDULE",
    IGNORE: "IGNORE"
  };

  const consistency = allowed[finalLabel].includes(input.recommendedAction)
    ? "PASS"
    : "ADJUSTED";

  const normalizedAction =
    consistency === "PASS" ? input.recommendedAction : defaultAction[finalLabel];

  return {
    finalLabel,
    normalizedAction,
    policyTrace: { rule_id: ruleId, consistency }
  };
}

function hasCompletedEvidence(events: Array<{ type: string; payload?: any }>) {
  return events.some((e) => {
    if (e.type !== "COMPLETED") return false;
    const p = e.payload ?? {};
    return Boolean(
      p.artifact_link ||
        (typeof p.reflection_text === "string" && p.reflection_text.length >= 50) ||
        p.done_checklist === true
    );
  });
}

function canCreateKnowledgeCard(events: Array<{ type: string; payload?: any }>) {
  return hasCompletedEvidence(events);
}

function calcPointDelta(input: {
  eventType: string;
  itemId: string;
  dateKey: string; // YYYY-MM-DD
  isHighNoise: boolean;
  createdKnowledgeCard: boolean;
  dedupeStore: Set<string>;
}) {
  if (
    (input.eventType === "SCHEDULED" || input.eventType === "IGNORED") &&
    input.isHighNoise
  ) {
    const key = `${input.itemId}:CALM_POINT:${input.dateKey}`;
    if (input.dedupeStore.has(key)) return 0;
    input.dedupeStore.add(key);
    return 1;
  }

  if (input.eventType === "COMPLETED" && input.createdKnowledgeCard) {
    const key = `${input.itemId}:GROWTH_POINT:${input.dateKey}`;
    if (input.dedupeStore.has(key)) return 0;
    input.dedupeStore.add(key);
    return 2;
  }

  return 0;
}
```

---

## 9. MVP 验收标准（用于快速判断 demo 是否成立）

1) **端到端闭环**：粘贴 URL → 生成 Triage → 点击 ✅ → 生成 Knowledge Card → 在 Library 可检索到
2) **反垃圾**：未 ✅ 时只能 Index Card；Knowledge Card 不能被“纯收藏”创建
3) **可解释**：每张处置单 ≤3 条理由；用户能理解为何延后/忽略
4) **正反馈**：完成行动与理性延后会影响 points & 今日文案，且满足去重防刷
5) **策略稳定**：`NOW/LATER/IGNORE` 分布长期落在平衡区间，异常可被发现并调参

---

## 10. 测试护栏（vibe coding 的护栏落点）

### 10.1 Unit（Vitest）
- triage JSON schema 校验
- Knowledge Card 门禁逻辑
- item 状态派生逻辑（由 EventLog + Cards 推导）
- points 计算规则
- policy guardrail 裁决规则（R1/R2/R3）
- recommended_action 与 final_label 一致性修正规则
- SAFE_MODE 触发与默认降级策略

### 10.2 E2E（Playwright）
- 流程 1：URL → triage → index card → library 可见
- 流程 2：URL → triage → completed → knowledge card → library 可见
- 流程 3：remind 7 days → review 页可见并可标记相关性
- 流程 4：重复点击同类事件，积分不重复增长
- 流程 5：ASK_SOMEONE 生成可发送模板并完成记录

---

## 11. 里程碑（用于 Codex 规划，不是流水线）

### Milestone 1：闭环打通
- Item ingestion + readability
- Triage 生成 + schema 校验
- Detail 页展示 + 事件日志
- Index/Knowledge 卡片创建 + 门禁

### Milestone 2：可用性与展示
- Library 搜索/过滤
- Review 页面（提醒项展示）
- Cat/Points + 今日文案

### Milestone 3（可选）：轻量个性化
- 根据 👍👎 事件做简单排序调整（M1）
- 引入 `DEFERRED_BUT_IMPORTANT` 做阈值纠偏
- 启用 Knowledge Card 周预算与自动降级

---

## 12. 可选增强：轻量“图谱视图”（不影响 MVP）
如果你希望“用图谱展示知识库”，建议作为 **只读视图**：
- 仅纳入 3⭐（或 Completed 后）Knowledge Cards
- 边：卡片之间的相似度（embedding top-k）或共同概念
- 目的：导航/成就感，而不是知识本体系统

---

# 附录：事件类型枚举（建议）
- MORE_IMPORTANT
- LESS_IMPORTANT
- COMPLETED
- SCHEDULED
- IGNORED
- REMIND_7D
- OPEN_SOURCE
- MARK_RELEVANT
- MARK_NOT_RELEVANT
- ASK_SOMEONE_SENT
- DEFERRED_BUT_IMPORTANT
- CARD_REVISITED
- CARD_REFERENCED

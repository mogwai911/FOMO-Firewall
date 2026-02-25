# FOMO Firewall IA（纠偏版）

更新时间：2026-02-24  
范围：对应 `docs/fomo_firewall_prd_v2.md` 与纠偏开发事实。

## 1) 顶层导航（固定 4 入口）
1. 日报处置（`/app/digest`）
2. 学习会话（`/app/session`）
3. 记忆库（`/app/cards`）
4. 设置（`/app/settings`）

说明：
- `/app/sources` 不再是主导航入口，仅兼容跳转到设置页 RSS 分区。

## 2) 页面分工
- 日报处置：线索 triage、稍后看/去学习/忽略 处置、手动拉取并生成日报、覆盖策略确认、范围切换（当天/近3天/近7天）。
- 日报处置补充规则：范围切换只改查询，不触发生成；日报内容来自快照（手动生成后锁定）。
- 学习会话：最近会话列表、会话详情、消息流式回复、异步沉淀触发；列表简介优先显示 AI 总结。
- 记忆库：洞察卡列表与回溯，证据包详情入口（每次会话可手动生成 1 张高密度洞察卡）。
- 设置：RSS 管理（唯一入口）、定时、LLM 接入、角色偏好与导出。

## 3) 主流程（成功路径）
`设置 RSS/LLM -> 日报手动拉取并生成 -> 处置 -> DO 确认后直达会话 -> 触发洞察卡/证据包 -> 记忆库复习与回溯`

## 4) 关键导航规则
- Digest:
  - `稍后看/忽略`：原地更新处置状态。
  - `DO`：弹确认框，确认后直接进入/恢复会话。
  - 已处理区：可从“继续学习”恢复会话。
- Session:
  - 返回 Digest 时会话保留（状态可恢复）。
  - 会话可删除（数据库真实删除）；删除后不再出现在学习会话列表。
  - 生成任务完成后可跳转 Cards/Evidence。
- Cards/Evidence:
  - 支持回溯到对应 session。
  - 若会话已删除，则证据详情显示“会话已删除”降级提示，并禁用回会话动作。
- Settings:
  - RSS 新增/启停/删除后直接影响抓取来源。

## 5) 数据真源约束
- RSS：仅 DB（`/api/sources*`），不再以 localStorage 作为 RSS 真源。
- 设置：
  - `schedule/api`：DB（`/api/settings`）
  - UI 短期输入态可本地缓存，但提交后以 DB 返回为准。
- 日报读取真源：`DigestSnapshot(dateKey, windowDays)`。
- 日报运行态元信息：`DigestRun`（兼容与统计）。

## 5.1 Digest 状态保持
- URL 持久化参数：`tab/window/page`
- 页面返回与刷新优先使用 URL 状态；无 URL 时恢复最近一次 sessionStorage 状态。

## 6) 状态与任务
- Session 状态：`ACTIVE | PAUSED | CLOSED`
- Job 状态：`QUEUED | RUNNING | DONE | FAILED`
- 调度：通过应用内 heartbeat 触发 `POST /api/jobs/schedule_tick`（幂等）

## 7) 路由清单（主链路）
- `/app/digest`
- `/app/session`
- `/app/session/[sessionId]`
- `/app/cards`
- `/app/evidence/[evidenceId]`
- `/app/settings`

## 7.1 文案映射（降低理解负担）
1. `FYI`（系统枚举）-> UI 文案：`稍后看`
2. `FYI 列表`（路由标识）-> UI 文案：`稍后看列表`
3. 时间展示统一到小时粒度：`YYYY-MM-DD HH:00`

## 8) 实现对齐与差距（2026-02-22）
- 已对齐：
1. 导航结构与主链路路径对齐（4 顶层入口稳定）。
2. 设置页统一管理 RSS/定时/LLM，RSS 真源为 DB。
3. 日报支持手动拉取+生成、覆盖策略、DO 确认后直达会话，且范围切换只读。
4. 学习会话支持流式助手、自动保存、异步沉淀与回溯。
- 5. Digest 理由面板已升级为右侧 fixed overlay 抽屉（可见性与关闭路径稳定）。
- 主要差距：
1. 调度仍是应用内 heartbeat，不是独立后台调度（页面关闭时不触发）。
2. EventLogV2 仍是单用户假设（无 `userId`）。
3. 日报条数上限暂无设置入口（默认值在服务层）。
4. 去重策略当前以 `sourceId + url` 为主，尚未覆盖 `guid/hash`。
- 详见：`docs/fomo_firewall_gap_audit_2026-02-22.md`

# FOMO Firewall 技术栈分层清单（按功能模块）

更新时间：2026-02-24  
适用范围：当前仓库主线实现（`/app` + `v2 API`）

## 1. 全局基础栈

| 类别 | 技术栈 | 备注 |
|---|---|---|
| 前端框架 | Next.js 16 (App Router), React 19 | 页面、路由、API Route 同仓 |
| 语言 | TypeScript 5（strict） | 全栈统一 TS |
| 数据层 | Prisma 6 + SQLite | 开发库：`file:./dev.db`；e2e 库：`file:./e2e.db` |
| 校验 | Zod | 用于领域 schema（triage/profile） |
| 单元测试 | Vitest 3 | 服务层/API/UI 单测 |
| E2E 测试 | Playwright 1.52 | 主链路端到端验证（独立 DB 隔离） |
| 脚本工具 | Bash + curl | e2e 运行辅助、调度循环 |

## 2. 模块级技术栈映射

| 功能模块 | 主要技术栈 | 关键文件 |
|---|---|---|
| 应用壳与 IA 路由 | Next.js App Router, React Client Components, CSS Modules | `src/components/app-shell.tsx`, `src/app/app/page.tsx`, `src/app/app/digest/page.tsx`, `src/app/app/sources/page.tsx`, `src/app/app/cards/page.tsx`, `src/app/app/fyi/page.tsx` |
| Sources（订阅源管理） | Next API Routes + Prisma ORM + RSS 拉取服务 | `src/app/api/sources/route.ts`, `src/app/api/sources/[id]/toggle/route.ts`, `src/lib/services/sources-service.ts`, `src/lib/services/rss-fetch.ts`, `src/lib/services/signal-ingest.ts` |
| Digest（日报生成与排序） | 服务分层（service + API），角色化评分策略，EventLog 反馈加权 | `src/app/api/digest/[date]/generate/route.ts`, `src/lib/services/digest-service.ts` |
| Disposition（FYI/DO/DROP） | API + Prisma upsert + 事件记录 | `src/app/api/signals/[id]/disposition/route.ts`, `src/lib/services/disposition-service.ts` |
| Triage（推荐与解释） | Agent（heuristic）+ Provider 路由（local/remote）+ 持久化 | `src/lib/agent/triage-agent.ts`, `src/lib/llm/triage-card-provider.ts`, `src/lib/services/triage-v2-service.ts`, `src/app/api/signals/[id]/triage/route.ts` |
| Session（学习会话） | 会话状态机（ACTIVE/PAUSED/CLOSED）+ 消息持久化 + 读取聚合 | `src/lib/services/session-v2-service.ts`, `src/lib/services/session-read-service.ts`, `src/app/api/sessions/route.ts`, `src/app/api/sessions/[id]/messages/route.ts`, `src/app/api/sessions/[id]/route.ts`, `src/app/api/sessions/[id]/status/route.ts` |
| Session 问题卡 Agent | 基于对话上下文的动态问题生成 | `src/lib/agent/session-question-agent.ts`, `src/app/app/session/[sessionId]/page.tsx` |
| 异步 Job 与沉淀（Cards/Evidence） | 队列派发 + worker 执行 + Prisma 持久化 | `src/lib/services/job-queue.ts`, `src/lib/services/job-worker.ts`, `src/lib/services/job-service.ts`, `src/app/api/sessions/[id]/jobs/route.ts` |
| Insight Cards | API 查询 + JSON 卡片结构 | `src/app/api/insight_cards/route.ts`, `src/app/app/cards/page.tsx`, `src/lib/services/job-service.ts` |
| Evidence Packs | API 查询 + 会话回溯 transcript | `src/app/api/evidence_packs/route.ts`, `src/app/api/evidence_packs/[id]/route.ts`, `src/lib/services/evidence-service.ts`, `src/app/app/evidence/[evidenceId]/page.tsx` |
| FYI 独立列表 | API + 页面路由 + Disposition 复用 | `src/app/api/signals/fyi/route.ts`, `src/lib/services/fyi-service.ts`, `src/app/app/fyi/page.tsx` |
| EventLog v2（行为事件） | Prisma 事件表 + 服务记录 + 反馈汇总 | `src/lib/services/eventlog-v2-service.ts`, `src/app/api/signals/[id]/events/route.ts`, `prisma/schema.prisma` |
| Profile（角色偏好） | 单用户 profile API + triage role 注入 | `src/app/api/profile/route.ts`, `src/lib/domain/profile-schema.ts`, `src/app/app/settings/page.tsx` |
| Settings（定时/API）入库 | AppSettings 单例模型 + GET/POST API + 前端同步 | `src/lib/services/app-settings-service.ts`, `src/app/api/settings/route.ts`, `prisma/schema.prisma`, `src/app/app/settings/page.tsx` |
| 调度（Scheduler） | 定时 tick 服务 + API 触发 + Bash loop | `src/lib/services/scheduler-service.ts`, `src/app/api/jobs/schedule_tick/route.ts`, `scripts/scheduler-loop.sh`, `package.json` |
| 统一存储抽象 | Storage Facade（服务层与 ORM 解耦） | `src/lib/storage/app-storage.ts` |

## 3. 数据模型栈（v2 主线）

| 领域 | 模型/枚举 | 关键技术 |
|---|---|---|
| 来源与信号 | `Source`, `Signal`, `SignalTriage`, `SignalDisposition` | Prisma schema + 关系索引 |
| 会话与消息 | `Session`, `SessionMessage` | 状态枚举 + 关联读取 |
| 异步任务 | `Job`, `JobTypeV2`, `JobStatusV2` | 队列状态流转 |
| 沉淀产物 | `InsightCard`, `EvidencePack` | JSON 内容存储 |
| 行为反馈 | `EventLogV2`, `EventTypeV2` | 事件驱动反馈策略 |
| 用户配置 | `UserProfile`, `AppSettings` | profile 与系统配置分离 |

参考：`prisma/schema.prisma`

## 4. 测试与质量栈

| 维度 | 技术栈 | 关键位置 |
|---|---|---|
| 单测 | Vitest | `tests/unit/**` |
| E2E | Playwright | `tests/e2e/**` |
| DB Fixture | PrismaClient seed/cleanup | `tests/e2e/fixtures/db-seed.ts` |
| 构建门禁 | Next build + TypeScript 检查 | `npm run build` |
| 运行门禁脚本 | npm scripts | `package.json` |
| e2e 数据隔离 | Bash + Node resolver | `scripts/e2e-test.sh`, `scripts/e2e-db-url.js` |

## 5. 运行与运维相关脚本

| 命令 | 用途 | 技术栈 |
|---|---|---|
| `npm run dev` | 本地开发服务 | Next.js dev server |
| `npm run test -- --run` | 全量单测 | Vitest |
| `npm run test:e2e` | 全量 e2e | Playwright + `scripts/e2e-test.sh` |
| `npm run scheduler:tick` | 手动触发一次调度 | curl + API route |
| `npm run scheduler:loop` | 持续轮询调度 tick | Bash loop |

## 6. 说明（当前架构状态）

- `/app` 主路径已完成真实 API/DB 化，不依赖 mock store。
- `/prototype` 保留为原型演示路径，仍可使用 mock 语义。
- 仓库中仍存在部分 v1 legacy 模型与服务（如 `Item/Triage/EventLog` 及相关 service），当前主业务路径不依赖它们。
- e2e 执行默认使用独立数据库，避免 `resetAppData` 清空开发库配置（RSS/LLM）。
- 2026-02-24 起，卡片沉淀主模型统一为 `InsightCard`（`INSIGHT_CARD` + `/api/insight_cards`）。

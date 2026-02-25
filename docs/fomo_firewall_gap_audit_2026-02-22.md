# FOMO Firewall v2 差距审查（实现 vs PRD/IA/流程图）

更新时间：2026-02-22  
审查基线：`docs/fomo_firewall_prd_v2.md`、`docs/fomo_firewall_ia_v1.md`、`docs/业务流程图.mmd`

## 1. 结论摘要

- 主链路已可跑通：`设置 RSS/LLM -> 手动生成日报 -> FYI/DO/DROP -> DO 进入学习会话 -> 异步生成闪卡/证据包 -> 记忆库回溯`。
- IA（4 顶层入口）与当前实现基本一致。
- 存在 4 个主要差距，当前均不阻断 Demo，但会影响“生产稳态/可运营性”。

## 2. 对齐矩阵

| 模块 | PRD/IA/流程图要求 | 当前实现 | 状态 |
|---|---|---|---|
| 导航与入口 | 顶层固定：日报处置/学习会话/记忆库/设置 | `src/components/app-shell.tsx` 已对齐 | ✅ |
| RSS 真源 | RSS 在设置页管理，入库为真源 | `src/app/app/settings/page.tsx` + `/api/sources*` 已对齐 | ✅ |
| 日报生成 | 手动拉取+生成，支持覆盖策略 | `/api/digest/:date/manual-refresh` + Digest UI 已对齐 | ✅ |
| 处置闭环 | FYI/DO/DROP，DO 直接进入会话 | `/api/signals/:id/enter-session` + Digest DO 确认跳转已对齐 | ✅ |
| 学习会话 | 默认保存、可恢复、流式助手 | `/api/sessions/:id/messages/stream` + Session 页面已对齐 | ✅ |
| 异步沉淀 | 闪卡/证据包异步生成、可回溯 | Job + Cards + Evidence 已对齐 | ✅ |
| 调度触发 | 定时触发拉取与日报生成 | 应用内 heartbeat + `schedule_tick`（页面可见时） | ⚠️ 部分对齐 |
| 事件日志 | 反馈事件可记录到 EventLog（含 user 维度） | `EventLogV2` 已有事件，但当前单用户无 `userId` | ⚠️ 部分对齐 |
| 去重策略 | url/guid/hash 多维去重 | 当前以 `sourceId + url` 为主，未用 guid/hash | ⚠️ 部分对齐 |
| 日报控量可配置 | 默认 20，可配置 | 默认 20 生效，但暂无设置项可配置 | ⚠️ 部分对齐 |

## 3. 主要差距（按优先级）

## P1（建议近期补齐）

1. EventLog 缺少 `userId` 维度（当前单用户假设）。
2. 去重策略未覆盖 `guid/hash`（仅 `sourceId + url`）。
3. 日报条数上限缺少设置入口（仅代码默认值）。

## P2（可排期）

1. 调度依赖应用前台心跳，不是独立后台任务（页面关闭时不触发）。
2. PRD 原文中的独立 Sources 页面已被 IA 纠偏为设置页分区；产品叙事需保持一致口径。

## 4. 本次已完成纠偏（2026-02-22）

1. e2e 切换为独立数据库，不再污染开发库配置与 RSS：
   - `scripts/e2e-db-url.js`
   - `scripts/e2e-test.sh`
2. Digest 手动刷新可见性修复（避免“生成失败”误判）：
   - 刷新摘要新增：日报总条目/待处理/已处理
   - 生成成功后自动切回“待处理”标签
   - 文件：`src/app/app/digest/page.tsx`
3. Digest 文案可读性修复：
   - 覆盖确认弹窗修复 `\\n` 乱码并改为多行清晰描述
   - `FYI` UI 文案替换为“稍后看”
   - 时间展示从秒级 ISO 调整到小时粒度
   - 处置抽屉原文支持折叠/展开，引用片段优先显示 AI 总结

## 5. 验证证据

- 单测：`npm run test -- --run tests/unit/ops/e2e-db-url.test.ts`
- e2e：`npm run test:e2e -- tests/e2e/m0-settings-to-digest.spec.ts`
- e2e：`npm run test:e2e -- tests/e2e/m11-digest-manual-refresh.spec.ts`
- 全量单测：`npm run test -- --run`（77 files / 211 tests）
- 构建：`npm run build`

# Session LLM Streaming Runbook

## Scope
Runbook for Session assistant real-LLM streaming path:
- API: `POST /api/sessions/:id/messages/stream`
- UI: `/app/session/:sessionId`
- Provider: OpenAI-compatible `chat/completions`

## 1. Local setup
1. Start app:
```bash
npm run dev
```
2. Open settings page: `/app/settings`.
3. In `LLM 接入` section:
- `LLM Base URL`: e.g. `https://api.openai.com/v1`
- `LLM API Key`: provider key
4. Save via `保存 LLM 配置`.

## 2. Manual verification
1. Go `/app/digest` and mark one signal as `DO`.
2. Confirm dialog, then enter Session directly.
3. Send a message.
4. Expect stream behavior:
- immediate user message persisted
- assistant streaming bubble appears
- final assistant message persisted after stream completes

## 3. Automated verification
Default gates:
```bash
npm run test -- --run
npm run test:e2e
npm run build
```

Optional real-LLM gate:
```bash
export LLM_E2E_BASE_URL="https://api.openai.com/v1"
export LLM_E2E_API_KEY="<your-key>"
# optional:
export TRIAGE_LLM_MODEL="gpt-4o-mini"

npm run test:e2e:llm
# release gate (fails if env missing or spec skipped):
npm run gate:release:llm
```

## 4. Expected fallback behavior
When Base URL / API key is missing:
- user message is still saved
- stream emits `error` event with `LLM_CONFIG_MISSING`
- no assistant message is persisted

## 5. Common error codes
- `LLM_CONFIG_MISSING`: settings missing base URL or API key.
- `LLM_REQUEST_FAILED`: provider request failed (status/network).
- `LLM_STREAM_PARSE_FAILED`: malformed/empty stream payload.
- `SESSION_NOT_FOUND`: invalid session id.

## 6. Operational notes
- EventLog currently assumes single-user mode (no `userId` in `EventLogV2`).
- Real-LLM e2e is intentionally isolated from default CI gate to avoid external flakiness.

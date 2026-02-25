# FOMO Firewall (MVP)

FOMO Firewall is a guardrail-first workflow for information overload:

`设置 RSS/LLM -> 日报处置 -> 学习会话 -> 洞察沉淀`

Current implementation is a single Next.js app with Prisma + SQLite.

## Tech Stack

- Next.js 16 + React 19 + TypeScript
- Prisma 6 + SQLite
- Vitest (unit) + Playwright (e2e)
- OpenAI-compatible LLM API integration

## Quick Start (Local)

### 1) Install

```bash
npm install
```

### 2) Configure environment

Copy example and set your own values:

```bash
cp .env.example .env
```

Required:
- `DATABASE_URL`
- `APP_SETTINGS_ENCRYPTION_KEY` (base64 32-byte key)

Generate encryption key example:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3) Prepare database

```bash
npx prisma generate
npx prisma db push
```

### 4) Start app

```bash
npm run dev
```

Open: `http://localhost:3000`

## Tests & Build

```bash
npm run test -- --run
npm run test:e2e
npm run build
```

Real LLM e2e gate (optional release gate):

```bash
export LLM_E2E_BASE_URL="https://api.openai.com/v1"
export LLM_E2E_API_KEY="<key>"
npm run gate:release:llm
```

## Release Sanitization

Before release publish, run:

```bash
npm run release:sanitize
```

It will:
- keep default RSS sources as baseline:
  - `https://www.jiqizhixin.com/rss`
  - `https://www.qbitai.com/feed`
- clear personal LLM config from DB (`apiBaseUrl/apiKey/apiModel`)

## Docker One-Command Deployment

### 1) Ensure `.env` exists with:
- `APP_SETTINGS_ENCRYPTION_KEY`

### 2) Build and run

```bash
docker compose up -d --build
```

Open: `http://localhost:3000`

Data persistence:
- SQLite is mounted to Docker volume `fomo_firewall_data` at `/app/data/app.db`

### 3) Stop

```bash
docker compose down
```

## GitHub Publish (first time)

```bash
git init
git branch -M main
git remote add origin git@github.com:<you>/<repo>.git
git add .
git commit -m "chore: mvp closeout baseline"
git push -u origin main
```

If using HTTPS remote:

```bash
git remote add origin https://github.com/<you>/<repo>.git
```

## Notes

- This public repo intentionally excludes local project docs used during development.

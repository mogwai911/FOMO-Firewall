# MVP Closeout Checklist

Date: 2026-02-25  
Scope: Stage closeout for Option B (release-safe)

## 1) Baseline Freeze
- [x] Closeout plan documented: `docs/plans/2026-02-25-mvp-stage-closeout-release-plan.md`
- [x] Baseline docs indexed in README
- [ ] Final freeze tag/commit created

## 2) Sanitization
- [x] Default RSS baseline defined in code
- [x] Release sanitize script added (`npm run release:sanitize`)
- [x] Release sanitize script execution verified（使用备份恢复方式在本地 DB 验证）
- [x] `.env.example` created
- [x] `.gitignore` created

## 3) Review Gate
- [x] Review report document created (`docs/release/code-review-report.md`)
- [x] Critical findings = 0
- [x] Important findings = 0

## 4) Quality Gate
- [x] `npm run test -- --run` pass
- [x] `npm run test:e2e` pass
- [x] `npm run build` pass

## 5) Docker Gate
- [x] `Dockerfile` added
- [x] `docker-compose.yml` added
- [x] `.dockerignore` added
- [x] Container entrypoint with DB init added
- [ ] `docker compose up -d --build` pass（当前环境未安装 Docker，待目标机执行）
- [ ] Smoke check pass (`http://localhost:3000`)（当前环境未安装 Docker，待目标机执行）

## 6) GitHub Publish
- [x] `git init` completed
- [x] `origin` configured
- [x] first release-safe commit created（`6cee185`）
- [ ] push to `main` successful（待本机完成 GitHub 认证）

## 7) Post-publish
- [ ] Quick install/run instructions validated on clean machine
- [ ] Release notes snapshot added to development log

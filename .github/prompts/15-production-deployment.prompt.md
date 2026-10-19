---
mode: agent
description: Phase 15 - Production build and deployment
---
# Phase 15 — Production Deployment
Read: docs/19-deployment-production.md (authoritative), docs/06-security-rules.md.

## Task
1. `apps/api/Dockerfile` and `apps/web/Dockerfile` (multi-stage, node:22-alpine, non-root, healthcheck, Next.js standalone output). The api image runs both `api` and `worker` via different commands.
2. `infra/docker-compose.prod.yml` with services from docs/19 (caddy, web, api, worker, postgres pgvector, redis with AOF, minio, livekit, optional clamav/prometheus/grafana), internal network, restart policies, healthchecks, resource limits, named volumes, env from `.env.production`.
3. `infra/caddy/Caddyfile` (domains from env, HTTPS, gzip, security headers, WebSocket proxy for api, reverse proxy for rtc if used).
4. `infra/scripts/`: `deploy.sh` (pull, migrate deploy, up -d, smoke test, rollback on failure), `backup.sh` (pg_dump → S3, retention), `restore.sh`.
5. `.github/workflows/deploy.yml` per docs/19 (build, push GHCR, SSH deploy, migrate, smoke test).
6. Write `docs/RUNBOOK.md`: server setup commands (user, ufw, docker), first deploy, creating Super Admin, configuring Google/Stripe/Recall/LiveKit production URLs, backup & restore drill, rollback, scaling steps, troubleshooting table, go-live checklist.
7. Add `/metrics` (internal only) and Sentry hooks (env-gated).

## Definition of Done
On a clean Ubuntu server following RUNBOOK only: stack starts, HTTPS works, `/health` ok, migrations applied, Super Admin can log in, a test payment succeeds, a backup is created and a restore is verified.

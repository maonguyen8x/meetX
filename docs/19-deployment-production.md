# 19 — Build & Deploy to Production (Docker Compose on a Linux server)

## Target
Ubuntu 22.04/24.04 VPS (min 4 vCPU, 8 GB RAM, 80 GB SSD for the app stack; LiveKit media is bandwidth-heavy, consider LiveKit Cloud or a separate server). Domains: `app.example.com` (web), `api.example.com` (API + WebSocket), `rtc.example.com` (LiveKit), optional `files.example.com` (MinIO) — all with DNS A records to the server.

## Services (`infra/docker-compose.prod.yml`)
`caddy` (reverse proxy + automatic HTTPS), `web` (Next.js standalone), `api`, `worker` (BullMQ jobs + ingestion; same image as api, different command), `postgres` (image with pgvector, volume), `redis` (AOF on), `minio` or external S3, `livekit` (host network or ports 7880/tcp, 7881/tcp, 3478/udp, 50000-60000/udp), `clamav` (optional), `prometheus` + `grafana` (optional).
Only caddy (80/443) and livekit ports are public. Postgres, Redis, MinIO API stay on the internal network.

## Build
- `apps/api/Dockerfile` and `apps/web/Dockerfile`: multi-stage, `node:22-alpine`, pnpm deploy/prune, non-root user, `HEALTHCHECK`.
- GitHub Actions `deploy.yml`: on tag `v*` → run CI → build images → push to GHCR → SSH to server → `docker compose pull && docker compose up -d` → `docker compose run --rm api pnpm prisma migrate deploy` → smoke test `/health`.
- Zero-downtime-ish: start new `api`, health check, then switch; keep previous image tag for rollback.

## Server setup checklist
1. Create a non-root sudo user, SSH keys only, disable password login.
2. `ufw allow 22,80,443/tcp` + LiveKit ports; enable ufw; install fail2ban; enable unattended-upgrades.
3. Install Docker Engine + compose plugin.
4. Clone repo to `/opt/interpreter-ai`, create `/opt/interpreter-ai/.env.production` (chmod 600) from `.env.example`; set strong secrets (`openssl rand -base64 48`).
5. Point DNS, run `docker compose -f infra/docker-compose.prod.yml up -d`.
6. Run migrations and seed the first Super Admin (`SEED_SUPER_ADMIN_EMAIL/PASSWORD`), change password at first login.
7. Configure external services for production: Google OAuth redirect `https://app.example.com/api/auth/callback/google` (and publish the consent screen), Stripe live keys + webhook endpoint `https://api.example.com/v1/billing/webhook`, Recall webhook `https://api.example.com/v1/webhooks/meeting-bot`, LiveKit URL `wss://rtc.example.com`, email SMTP/Resend for notifications.

## Operations
- **Backups**: nightly `pg_dump` (custom format) to S3 with 30-day retention + weekly full volume snapshot; MinIO bucket replication or provider versioning; **test a restore monthly** (documented command sequence in RUNBOOK).
- **Logging**: pino JSON to stdout → `docker logs` / Loki; request IDs; Sentry for web + api errors.
- **Monitoring**: uptime check on `/health` and `/ready`, Prometheus metrics endpoint `/metrics` (internal), alerts for queue backlog, failed payments, disk > 80%, 5xx rate, p95 latency.
- **Updates**: monthly OS patches, dependency updates via Dependabot, `pnpm audit` in CI.
- **Rollback**: `IMAGE_TAG=<previous> docker compose up -d`; DB migrations must be backward compatible (expand → migrate → contract).
- **Scaling**: run multiple `api` replicas behind caddy (sticky by `sessionId` for WebSocket via Redis state), scale `worker` separately, move Postgres to a managed service, put MinIO/S3 + CDN for files, dedicated LiveKit nodes.

## Production env additions
`NODE_ENV=production`, `APP_URL`, `API_URL`, `CORS_ORIGINS`, `S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY/S3_REGION`, `EMBEDDING_PROVIDER/EMBEDDING_MODEL/EMBEDDING_DIM`, `WEB_SEARCH_PROVIDER/WEB_SEARCH_API_KEY`, `ANSWER_MODEL`, `ANSWER_REASONING_MODEL`, `SMTP_*` or `EMAIL_API_KEY`, `SENTRY_DSN`, `SEED_SUPER_ADMIN_EMAIL/PASSWORD`, `DATA_ENCRYPTION_KEY`.

## Go-live checklist
All CI green · migrations applied · super admin password changed · HTTPS valid (A+ on SSL Labs) · Stripe live webhook delivering · test payment + refund done · auto-renew test with a DAY plan done · backup + restore verified · rate limits on · CSP on · monitoring alerts firing to your email/Slack · RUNBOOK reviewed · legal pages (Terms, Privacy, AI-interpreter consent) published.

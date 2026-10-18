---
mode: agent
description: Phase 08 - Testing, hardening, demo
---
# Phase 08 — Testing, Hardening, Demo
Read: docs/11-testing-strategy.md, docs/06-security-rules.md.

## Task
1. Fill test gaps to meet coverage targets; add Playwright E2E per docs/11; add `pnpm bench:pipeline`.
2. Security pass against every item in docs/06; add missing rate limits, CSP, input limits; run `pnpm audit`.
3. Add seed script with demo user, glossary, sample meeting.
4. Write `docs/RUNBOOK.md` (deploy with Docker, env setup, troubleshooting) and update README with the demo script.
5. Production Dockerfiles for api and web; `docker compose -f infra/docker-compose.prod.yml up` runs the full stack.

## Definition of Done
Manual demo script in docs/11 passes end to end; CI green.

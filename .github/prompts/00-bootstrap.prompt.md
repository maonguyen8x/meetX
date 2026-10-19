---
mode: agent
description: Phase 00 - Bootstrap monorepo and infrastructure
---
# Phase 00 — Bootstrap
Read: AGENTS.md, docs/00-getting-started-guide.md, docs/03-tech-stack.md, docs/04-folder-structure.md, docs/05-coding-conventions.md.

## Task
Create the complete monorepo skeleton exactly as in docs/04-folder-structure.md (folders may already exist; add files):
1. Root: `package.json` (scripts: dev, build, lint, typecheck, test, test:e2e, db:migrate, db:seed, db:studio, infra:up, infra:down), `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.env.example` (ALL variables from docs/03 and docs/19, with comments), Prettier + ESLint configs, `tsconfig.base.json` (strict).
2. `packages/shared`: `languages.ts` (vi, ja, en + trigger phrases), `roles.ts`, `permissions.ts` (keys from docs/14), `plans.ts`, and Zod schema folders (empty index files are fine). Export from `index.ts`.
3. `apps/api`: Fastify app with `config/env.ts` (Zod-validated), pino logger, error handler, `GET /health` and `GET /ready`, `worker.ts` entry (BullMQ bootstrap, no jobs yet). Do NOT write the Prisma schema yet (Phase 01).
4. `apps/web`: Next.js + Tailwind + shadcn/ui, next-intl with vi/en/ja, root layout, theme provider (light/dark), fonts (Inter, Noto Sans JP), teal design tokens from docs/17, a placeholder home page.
5. `infra/docker-compose.yml` (dev): postgres using image `pgvector/pgvector:pg16`, redis, minio (with bucket auto-create), livekit (dev keys), mailpit. Named volumes, healthchecks.
6. `.github/workflows/ci.yml`: install, lint, typecheck, test, build.

## Definition of Done
`cp .env.example .env && pnpm install && pnpm infra:up && pnpm dev` runs; web home renders in 3 languages; `/health` returns ok; `pnpm lint && pnpm typecheck` pass.

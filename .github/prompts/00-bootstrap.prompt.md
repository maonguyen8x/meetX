---
mode: agent
description: Phase 00 - Bootstrap monorepo and infrastructure
---
# Phase 00 — Bootstrap
Read: AGENTS.md, docs/03-tech-stack.md, docs/04-folder-structure.md, docs/05-coding-conventions.md.

## Task
Create the complete monorepo skeleton exactly as in docs/04-folder-structure.md:
1. Root: `package.json` (scripts: dev, build, lint, typecheck, test, db:migrate, infra:up, infra:down), `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.env.example` (all vars from docs/03), Prettier + ESLint configs, `tsconfig.base.json` (strict).
2. `packages/shared`: `languages.ts` (vi, ja, en with metadata + trigger phrases), Zod schemas for settings, events (WebSocket), usage; export from `index.ts`.
3. `apps/api`: Fastify app with `config/env.ts` (Zod), pino logger, error handler, health route `GET /health`, Prisma schema with models: User, Settings, Meeting, Turn, Summary, GlossaryTerm, UsageEvent, Wallet, Bot, Room.
4. `apps/web`: Next.js + Tailwind + shadcn/ui init, next-intl with vi/en/ja, base layout, theme provider, fonts (Inter, Noto Sans JP).
5. `infra/docker-compose.yml`: postgres, redis, livekit (dev config).
6. `.github/workflows/ci.yml`: install, lint, typecheck, test, build.

## Definition of Done
`pnpm install && pnpm infra:up && pnpm db:migrate && pnpm dev` runs; `/health` returns ok; web home renders in 3 languages; CI passes locally.

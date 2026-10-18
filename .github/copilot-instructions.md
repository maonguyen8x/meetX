# Copilot Instructions (always loaded — keep short)

- Language: TypeScript strict everywhere. Node 22, pnpm workspaces monorepo (`apps/web`, `apps/api`, `packages/shared`).
- Frontend: Next.js (App Router), React, Tailwind CSS, shadcn/ui, Zustand, TanStack Query, lucide-react.
- Backend: Fastify, Zod validation, Prisma + PostgreSQL, Redis, `ws` WebSocket, LiveKit server SDK.
- All AI vendors sit behind interfaces in `apps/api/src/providers/{stt,translate,tts}`. Never call a vendor SDK outside `providers/`.
- Models/keys come ONLY from env (`apps/api/src/config/env.ts`, validated by Zod). Never hardcode keys or model names in logic.
- Shared types/schemas live in `packages/shared` and are imported by both apps.
- Source tree is defined in `docs/04-folder-structure.md`. Do not invent new top-level folders.
- Follow `docs/05-coding-conventions.md` and `docs/06-security-rules.md` strictly.
- UI text must go through i18n (`vi`, `en`, `ja`); no hardcoded user-facing strings.
- Write the unit test next to each new service/util (`*.test.ts`, Vitest).
- Output complete files. Explain only what is non-obvious. Ask a question only if a requirement is truly missing.

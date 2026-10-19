# Copilot Instructions (always loaded — keep short)

- TypeScript strict everywhere. Node 22, pnpm workspaces (`apps/web`, `apps/api`, `packages/shared`).
- Web: Next.js App Router, Tailwind, shadcn/ui, Zustand, TanStack Query, next-intl (vi/en/ja), lucide-react.
- API: Fastify, Zod, Prisma + PostgreSQL (pgvector), Redis, BullMQ, `ws`, LiveKit SDK, S3 SDK.
- Every external vendor sits behind an interface in `apps/api/src/providers/*`. Never call a vendor SDK elsewhere. Keys/models come only from validated env.
- Database follows `docs/13-database-design.md` exactly. Authorization follows `docs/14-rbac-accounts-organizations.md` via `authorization/policy.ts`; never trust the frontend.
- Tenant isolation is mandatory (docs/06 items 16-20). Never filter access after retrieval.
- Source tree is `docs/04-folder-structure.md`. Do not invent top-level folders.
- UI: teal glass style (docs/17); all user-facing text through i18n.
- Add Vitest tests beside new services. Output complete files; explain only non-obvious points.

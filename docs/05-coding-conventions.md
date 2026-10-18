# 05 — Coding Conventions

## General
- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`. No `any` (use `unknown` + Zod parse).
- Files `kebab-case.ts`; React components `PascalCase.tsx`; types/interfaces `PascalCase`; constants `UPPER_SNAKE_CASE`.
- Named exports only (except Next.js pages/layouts).
- Functions ≤ 50 lines, files ≤ 250 lines. Pure functions where possible.
- Async: always `async/await`; never leave a floating promise; handle errors at boundaries.
- Errors: throw `AppError(code, message, httpStatus)` from `utils/errors.ts`. Never swallow errors silently.
- Logging: `pino` logger only. No `console.log`. Never log audio, API keys, tokens, or full transcripts (log IDs and lengths).
- Comments explain *why*, not *what*. Public functions get TSDoc.

## Backend
- Layering per module: `routes.ts` (HTTP) → `service.ts` (business logic) → `repository.ts` (Prisma). Routes contain no logic.
- Validate every input/output with Zod schemas from `packages/shared`.
- Providers implement the interface in their `types.ts`; adapters never leak vendor types.
- Config only via `config/env.ts`.

## Frontend
- Server Components by default; add `"use client"` only for interactivity.
- Data fetching with TanStack Query; global UI state with Zustand; no prop drilling beyond 2 levels.
- Styling: Tailwind utilities + design tokens (see 09-ui-ux-spec.md). No inline style except dynamic values.
- Accessibility: every control has an accessible name; keyboard operable; focus ring visible; min tap target 44×44 px.
- All text through `next-intl` messages (`vi`, `en`, `ja`).

## Git
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`).
- Branch per phase: `phase/NN-name`. PR must pass lint, typecheck, test.

## Testing
- Vitest unit tests beside source (`*.test.ts`). Mock providers with in-memory fakes.
- Coverage targets: pipeline + usage + billing ≥ 80%.

---
mode: agent
description: Phase 01 - Database schema, migrations, seed
---
# Phase 01 — Database
Read: docs/13-database-design.md (authoritative), docs/14-rbac-accounts-organizations.md, docs/05-coding-conventions.md.

## Task
1. Translate docs/13 into `apps/api/prisma/schema.prisma` — EVERY table, enum, relation, index and unique constraint listed. Use `@db.Uuid`, `@map` snake_case table/column names, `timestamptz`, soft-delete fields where marked (SD).
2. Add a raw SQL migration (first migration or an additional one) that: `CREATE EXTENSION IF NOT EXISTS vector, pg_trgm, citext;` adds `document_chunks.embedding vector(${EMBEDDING_DIM})` (use a documented placeholder and a script `pnpm db:set-embedding-dim` if Prisma cannot template env), generated `tsv` column, HNSW index (`vector_cosine_ops`), GIN indexes, check constraints (wallet balance ≥ 0, glossary single owner).
3. `apps/api/src/db/prisma.ts` and `redis.ts` clients.
4. `prisma/seed.ts`: seed `permissions`, `role_permissions` (matrix in docs/14), plans (Free, Pro monthly, Business yearly, Enterprise; each with quotas and allowed intervals), first SUPER_ADMIN from `SEED_SUPER_ADMIN_EMAIL/PASSWORD` (argon2id hash, `must_change_password` flag — add column if needed and update docs/13), demo organization, demo folders, system_settings defaults.
5. Add repository-level helper `scopeByActor(actor)` that returns Prisma `where` fragments for owner/org scoping (used by later phases).
6. Tests: seed idempotency; constraint tests (duplicate folder name, negative wallet rejected).

## Definition of Done
`pnpm db:migrate && pnpm db:seed` succeed on a fresh database; `pnpm db:studio` shows all tables from docs/13; tests pass.

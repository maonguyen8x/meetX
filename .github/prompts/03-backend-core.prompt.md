---
mode: agent
description: Phase 03 - Auth, settings, persona, memory data layer
---
# Phase 03 — Backend Core (settings, meetings, glossary)
Read: docs/13-database-design.md (interpreter section), docs/14-rbac-accounts-organizations.md, docs/06-security-rules.md, docs/10-api-contracts.md (REST part), docs/05-coding-conventions.md.

## Task
Auth, users, organizations and RBAC already exist from Phase 02 — reuse them, do not rewrite. Implement in `apps/api/src/modules`: `settings` (GET/PATCH, avatar upload with re-encode via sharp, voice preview endpoint stub), `meetings` (CRUD, list, export md/json), `memory` (glossary CRUD; summary storage), plugins: auth, cors, rate-limit, helmet, swagger.
Layering: routes → service → repository. Zod on all I/O using packages/shared schemas. Ownership checks on every resource. Encrypt transcript text columns (AES-256-GCM util in `utils/crypto.ts`).

## Tests
Unit tests for services; integration tests for settings and meetings routes.

## Definition of Done
All endpoints from docs/10 (non-realtime, non-billing) work and are covered by tests; swagger at `/docs`.

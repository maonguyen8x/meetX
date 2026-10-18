---
mode: agent
description: Phase 01 - Auth, settings, persona, memory data layer
---
# Phase 01 — Backend Core
Read: docs/06-security-rules.md, docs/10-api-contracts.md (REST part), docs/05-coding-conventions.md.

## Task
Implement in `apps/api/src/modules`: `auth` (JWT verify, refresh), `users`, `settings` (GET/PATCH, avatar upload with re-encode via sharp, voice preview endpoint stub), `meetings` (CRUD, list, export md/json), `memory` (glossary CRUD; summary storage), plugins: auth, cors, rate-limit, helmet, swagger.
Layering: routes → service → repository. Zod on all I/O using packages/shared schemas. Ownership checks on every resource. Encrypt transcript text columns (AES-256-GCM util in `utils/crypto.ts`).
Add Auth.js (Google + email) on web and a token bridge so the API accepts the session JWT.

## Tests
Unit tests for services; integration tests for settings and meetings routes.

## Definition of Done
All endpoints from docs/10 (non-realtime, non-billing) work and are covered by tests; swagger at `/docs`.

---
mode: agent
description: Phase 14 - Testing, hardening, demo
---
# Phase 14 — Testing, Hardening, Demo
Read: docs/11-testing-strategy.md, docs/06-security-rules.md.

## Task
1. Fill test gaps to meet coverage targets; add Playwright E2E per docs/11; add `pnpm bench:pipeline`.
2. Security pass against every item in docs/06; add missing rate limits, CSP, input limits; run `pnpm audit`.
3. Add seed script with demo user, glossary, sample meeting.
4. Update README with the demo script. (Production deployment is Phase 15.)
5. Add RBAC/tenant-isolation tests: a user must never read another user's or organization's folders, documents, chunks, meetings or invoices (see docs/14 and docs/06 items 16-20).

## Definition of Done
Manual demo script in docs/11 passes end to end; CI green.

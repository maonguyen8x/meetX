---
mode: agent
description: Phase 06 - Usage metering, wallet, Stripe billing
---
# Phase 06 — Usage & Billing
Read: docs/08-billing-pricing.md, docs/06-security-rules.md (item 11).

## Task
1. `config/pricing.ts` with vendor unit prices (env-overridable) and `MARKUP`, `CREDIT_USD` (DB-backed override).
2. `modules/usage`: record `usage_events` from every provider adapter result; credit calculation; wallet debit in DB transaction; `usage.tick` publisher; caps, warnings (20%, 5%), hard stop with 60 s grace.
3. `modules/billing`: Stripe Checkout for top-up packs, webhook with signature verification and idempotency, optional Pro subscription flag.
4. Endpoints `/usage/summary`, `/usage/balance`, `/billing/checkout`, `/billing/webhook`.
5. Web `usage` page: balance card, estimated minutes, charts (day/month/year), breakdown by kind, meetings table, CSV export, caps/alerts settings. Admin margin page.

## Tests
Unit: credit formula, wallet atomicity, caps. Integration: Stripe webhook idempotency.

## Definition of Done
Using the app decrements balance visibly in real time; exhausting balance stops interpretation gracefully.

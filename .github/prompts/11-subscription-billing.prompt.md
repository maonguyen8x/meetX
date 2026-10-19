---
mode: agent
description: Phase 11 - Plans, subscriptions, quotas, payments, auto-renew
---
# Phase 11 — Subscription Billing
Read: docs/15-subscription-billing-autorenew.md (authoritative), docs/08-billing-pricing.md (credit formula), docs/13-database-design.md (section 4), docs/06-security-rules.md (item 11).

## Task
1. `config/pricing.ts` + DB-backed overrides; `providers/payment` (`PaymentProvider` interface + `stripe` adapter + `fake` adapter for tests): create customer, Checkout session, subscription create/update/cancel with `interval` (day|week|month|year) and `interval_count`, customer portal, payment methods, invoices, charge-now, refunds, webhook signature verification.
2. `modules/billing`: plans listing, billing account, subscription lifecycle & state machine (docs/15), change plan/cycle/custom interval with proration rules, `auto_renew` toggle, `on_expiry_action` (NOTIFY_ONLY | SWITCH_TO_FREE | PAUSE | CANCEL), renew-now, invoices + payment retry, wallet top-up, webhook handler (idempotent through `webhook_events`).
3. `modules/usage`: record `usage_events` from every provider call (interpreter + knowledge); credit formula; wallet debits in transactions (never negative, concurrency-safe); `quota_counters` per period + gauges (storage/documents/members); `enforceQuota(metric, amount)` used by uploads, search, interpreter start; per-member quotas for organizations; `usage.tick` publisher.
4. Web `/billing` per docs/15 UI (current plan card with Renew/Pay now, quota meters, auto-renew panel with expiry-action radios, usage chart with Day/Week/Month/Year/Custom, payment methods, top-up, invoices table with PDF + Pay, enterprise extras). `/usage` page.
5. Admin billing endpoints required by docs/18.

## Tests
All acceptance tests listed at the end of docs/15, using the fake payment provider and a controllable clock.

## Definition of Done
With Stripe test keys: subscribe to a DAY plan, auto-renew charges and extends; turning auto-renew off applies the chosen expiry action; quotas show used/remaining; exhausting a quota blocks the action with an upgrade CTA; all tests pass.

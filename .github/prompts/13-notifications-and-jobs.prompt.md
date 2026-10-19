---
mode: agent
description: Phase 13 - Notifications, scheduled jobs, email
---
# Phase 13 — Notifications & Jobs
Read: docs/15-subscription-billing-autorenew.md (Notifications + Background jobs sections), docs/13-database-design.md (section 5).

## Task
1. `modules/notifications`: create/list/mark-read/read-all, preferences (per type in-app/email), SSE stream `/notifications/stream`, email delivery through `Mailer` interface with templates in vi/en/ja (renewal reminder, quota threshold, payment succeeded/failed, subscription expired, invitation, document ready/failed).
2. `jobs/`: BullMQ repeatable jobs exactly as the table in docs/15 (`subscription-renewal-scan`, `renewal-reminder-scan`, `dunning-retry`, `quota-threshold-check`, `period-reset`, `invoice-reconcile`) registered in `scheduler.ts`, all idempotent with deterministic job IDs and dedupe keys; run inside `worker.ts`.
3. Reminder offsets by cycle (YEAR 30/7/1 days, MONTH 7/3/1, WEEK 2/1 days, DAY 6/1 hours); quota thresholds 80/90/100 once per period; enterprise notifications also go to ORG_ADMINs.
4. Web: notification bell with unread badge + dropdown, `/notifications` page, preferences tab in settings.
5. Admin broadcast announcements (permission `notifications.broadcast`).

## Tests
Controllable clock tests: reminders fire at the right offsets exactly once; thresholds fire once; dunning schedule; preference opt-out respected.

## Definition of Done
Changing the clock/DB dates in a test environment triggers the expected notifications and renewals; emails appear in Mailpit during development.

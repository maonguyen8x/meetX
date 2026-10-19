---
mode: agent
description: Phase 10 - Admin panel, organization admin, settings pages
---
# Phase 10 — Admin Panel
Read: docs/18-admin-panel-spec.md (authoritative), docs/14-rbac-accounts-organizations.md, docs/17-ui-knowledge-dashboard.md (style).

## Task
1. `/admin/**` pages and backing endpoints per docs/18 section A: Overview (stats cards + charts), Users (server-side table, filters, drawer, create/edit/activate/deactivate/delete/change role/permission overrides/reset password/force logout/impersonate view-only), Create Admin (Super Admin only), Organizations, Plans & Pricing (CRUD, intervals, quotas, discounts), Subscriptions & Invoices (manual renew/pause/cancel/extend, refund), Usage & Margin, Knowledge moderation (metadata only unless permission), Audit logs (filter + CSV export), System settings (registration, upload limits, default plan, markup, maintenance mode, announcements, feature flags).
2. `/org/**` pages per section B (members, invitations, per-member quotas, org profile incl. tax code, shared glossary, billing link, org audit).
3. `/settings/**` tabs per section C.
4. Shared pieces: server-paginated `DataTable`, `ConfirmDialog` with reason field, `<Can>` gating, success/error toasts, CSV export util.
5. All destructive actions require confirmation + audit entry; sensitive ones require password re-auth.

## Tests
Playwright per role (SUPER_ADMIN, ADMIN, USER, ORG_ADMIN, ORG_MEMBER): allowed actions succeed, denied actions are hidden in UI AND rejected by API (403).

## Definition of Done
Every row in docs/14 matrix is demonstrably enforced end to end; admin pages are responsive and i18n'd.

# 18 — Admin Panel & Settings Specification

Routes under `/[locale]/admin` (ADMIN, SUPER_ADMIN), `/[locale]/org` (ORG_ADMIN), `/[locale]/settings` (everyone). Use the glass card style from docs/17 with a left sidebar on admin pages.

## A. Platform Admin (`/admin`)
| Page | SUPER_ADMIN | ADMIN |
|---|---|---|
| **Overview**: active users, new signups, MRR, revenue today/week/month/year, usage minutes/tokens, failed payments, storage used, queue health | ✔ | ✔ |
| **Users**: table (search, filter by role/status/org, pagination), detail drawer; actions **Create, Edit, Activate/Deactivate, Delete (soft), Change role, Grant/deny permission overrides, Reset password, Force logout, Impersonate (view-only, audited)** | all | read only |
| **Create Admin account** (form: name, email, temp password or invite link, permission overrides) | ✔ | — |
| **Organizations**: list, detail (members, plan, usage), create, edit, activate/deactivate, delete | ✔ | read + activate/deactivate |
| **Plans & Pricing**: CRUD plans, intervals, quotas, discounts, public/private | ✔ | — |
| **Subscriptions & Invoices**: all accounts, filter by status, manual renew / pause / cancel / extend, refund | ✔ | read |
| **Usage & Margin**: provider cost vs revenue, top consumers, markup setting | ✔ | read |
| **Knowledge moderation**: documents list across tenants (metadata), failed ingestions, re-process; content only with explicit permission | ✔ | metadata |
| **Audit logs**: filter by actor/action/date, export CSV | ✔ | ✔ |
| **System settings**: registration on/off, upload limits, default plan, email templates, provider toggles, feature flags, maintenance mode, announcement broadcast | ✔ | — |
Every destructive action: confirmation dialog stating the target, reason field, audit log entry.

## B. Enterprise admin (`/org`) — ORG_ADMIN
Members (invite by email, change `ORG_ADMIN/ORG_MEMBER`, activate/deactivate, remove), per-member quotas, organization profile (name, logo, tax code, address), shared glossary, shared folders & access policy, billing (docs/15), usage by member, audit log of the organization.

## C. Settings (`/settings`) — all users
Tabs: **Profile** (name, avatar, email, password, locale), **Interpreter persona** (name, avatar upload+crop, voice gender/style/speed, preview), **Languages & triggers**, **Memory & glossary**, **Knowledge preferences** (default folder scope, default search modes), **Privacy & storage** (history on/off, local vs cloud, export all data, delete account), **Notifications** (per type, in-app/email), **Security** (sessions list with revoke, 2FA TOTP optional), **Appearance** (theme, language).

## Requirements
- Server-side authorization for every action (docs/14); UI gating via `<Can>`.
- Tables: server-side pagination/sort/filter, CSV export, skeletons, empty and error states.
- Forms: Zod + react-hook-form, inline errors, disabled submit while pending, success toast.
- Seed script creates first SUPER_ADMIN from env; first login forces password change.
- Acceptance: Playwright tests per role proving allowed/denied actions in the matrix.

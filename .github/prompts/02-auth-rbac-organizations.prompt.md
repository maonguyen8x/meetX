---
mode: agent
description: Phase 02 - Authentication, RBAC, organizations, audit logs
---
# Phase 02 — Auth, RBAC, Organizations
Read: docs/14-rbac-accounts-organizations.md, docs/06-security-rules.md (items 2, 4, 5, 16, 19, 20), docs/10-api-contracts.md (Auth, Admin, Organizations sections), docs/13-database-design.md (identity section).

## Task
1. Auth (web: Auth.js with Credentials + Google; API: JWT access 15 min + rotating refresh tokens stored hashed in `sessions`): register, login, logout, forgot/reset password, email verify, sessions list/revoke, password hashing argon2id, login backoff. Inactive/suspended accounts cannot log in; deactivation revokes sessions.
2. `authorization/policy.ts`: `can(actor, permissionKey, resource?)` implementing the matrix and hierarchy rules in docs/14; `requirePermission()` Fastify preHandler; effective permissions = role ∪ ALLOW − DENY overrides; protection of the last active Super Admin.
3. Modules `users`, `admin` (users CRUD, activate/deactivate, delete soft, change role, permission overrides, create ADMIN, reset password, force logout), `organizations` (create, invite by email token, accept, members, role change, activate/deactivate, per-member quota endpoint stub), `audit` (plugin that writes `audit_logs` for every privileged action; read endpoints).
4. Web: login/register/forgot/accept-invite pages, route guard middleware (`/admin`, `/org`), `usePermissions()` and `<Can>` components, forced password change screen for seeded Super Admin.
5. Re-authentication (password confirm) for role change, delete, refund endpoints.
6. Mailer interface with `console` adapter (and Mailpit SMTP adapter) for invitations/reset emails.

## Tests (must exist)
Table-driven RBAC tests covering every row of the docs/14 matrix for all 5 role types; last-super-admin protection; cross-organization access denied; audit rows written; refresh token rotation and revocation.

## Definition of Done
Seeded Super Admin can log in, create an Admin and an organization with ORG_ADMIN, invite a member; Admin cannot create admins; deactivated user is logged out immediately; all RBAC tests pass.

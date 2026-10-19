# 14 — Accounts, Roles, Permissions, Organizations

## Account kinds
| Kind | Description |
|---|---|
| **Super Admin** (`platform_role=SUPER_ADMIN`) | Platform owner. Full control. At least one ACTIVE Super Admin must always exist (block deleting/deactivating the last one). |
| **Admin** (`ADMIN`) | Platform staff created ONLY by a Super Admin. Operates support, monitoring, content moderation. |
| **User** (`USER`) | Individual account with its own billing account, folders, meetings. |
| **Enterprise account** | An `organization` with its own billing account. Members have `org_role`: `ORG_ADMIN` (company admin) or `ORG_MEMBER` (normal employee). A member's `platform_role` is `USER`. |

## Permission keys (seeded in `permissions` / `role_permissions`)
`users.read`, `users.create`, `users.update`, `users.delete`, `users.activate`, `users.assign_role`, `admins.create`, `permissions.grant`,
`orgs.read`, `orgs.create`, `orgs.update`, `orgs.delete`, `orgs.activate`,
`org.members.read`, `org.members.manage`, `org.settings.manage`, `org.billing.manage`, `org.quota.manage`,
`billing.read.own`, `billing.manage.own`, `billing.read.all`, `plans.manage`, `payments.refund`,
`kb.read`, `kb.write`, `kb.share`, `kb.read.all` (moderation), `interpreter.use`, `usage.read.own`, `usage.read.all`,
`audit.read`, `system.settings.manage`, `notifications.broadcast`.

## Matrix (✔ allowed, — denied, ◐ limited)
| Capability | SUPER_ADMIN | ADMIN | USER | ORG_ADMIN | ORG_MEMBER |
|---|---|---|---|---|---|
| View all accounts | ✔ | ✔ (read-only, hides secrets) | — | ◐ own org members | — |
| Create account | ✔ | — | — | ◐ invite to own org | — |
| Edit account | ✔ | ◐ profile fields of USER/org members only | ◐ self | ◐ own org members (name, org_role≠owner) | ◐ self |
| Delete account | ✔ (soft delete, not last super admin) | — | ◐ self-delete request | ◐ remove member from org | — |
| Activate / deactivate | ✔ | ◐ USER and ORG accounts only | — | ◐ own org members | — |
| Create ADMIN accounts | ✔ | — | — | — | — |
| Assign roles / grant permission overrides | ✔ | — | — | ◐ ORG_ADMIN↔ORG_MEMBER in own org | — |
| Manage plans, pricing, system settings | ✔ | — | — | — | — |
| View platform usage / revenue | ✔ | ✔ | — | ◐ own org | — |
| View audit logs | ✔ | ✔ (own actions + user-facing) | — | ◐ own org | — |
| Use interpreter | ✔ | ✔ | ✔ | ✔ | ✔ |
| Own billing / subscription | ✔ | — | ✔ | ✔ (org) | — |
| Set member quotas | ✔ | — | — | ✔ | — |
| Knowledge base own folders | ✔ | ✔ | ✔ | ✔ + all org folders | ◐ per access_grants / org-visible folders |
| Read ALL knowledge bases (moderation) | ✔ | ◐ metadata only, content needs explicit `kb.read.all` override | — | — | — |

Hierarchy rules (enforce in `authorization/policy.ts`):
1. An actor can only modify accounts with a **strictly lower** rank (SUPER_ADMIN > ADMIN > USER). Super Admin may edit other Super Admins only when ≥ 2 exist.
2. Nobody can change their own role or deactivate themselves.
3. Role changes, activation changes, deletions, permission grants and admin creation ALWAYS write an `audit_logs` row.
4. Effective permissions = role_permissions ∪ ALLOW overrides − DENY overrides. DENY wins.
5. An INACTIVE/SUSPENDED user: all sessions revoked immediately; login returns `ACCOUNT_INACTIVE`; org membership remains but access blocked.
6. Deactivating an organization blocks all its members from org resources (they keep personal account if any).

## Organization rules
- Creating an enterprise account: Super Admin/Admin via admin panel OR self-service signup "For business" → creates `organization`, a billing account, creator becomes `ORG_ADMIN` + owner.
- Seat limit from plan (`max_members`); invitations by email token (7-day expiry); member can belong to multiple orgs (org switcher in header).
- Org data (folders with visibility `ORGANIZATION`, glossary, meetings with `organization_id`) belongs to the org: removing a member keeps data; ownership is transferred to the org owner.
- ORG_ADMIN can set per-member quotas (`member_quotas`).

## Implementation requirements
- Single `can(actor, permission, resource?)` function in `apps/api/src/authorization/policy.ts`; routes use a `requirePermission('key')` preHandler; services re-check resource ownership. Never rely on frontend hiding.
- Frontend: `usePermissions()` hook and `<Can permission="users.create">` component for UI gating only.
- Web route guards in middleware: `/admin/**` requires ADMIN or SUPER_ADMIN; `/org/**` requires ORG_ADMIN.
- Optional hardening: PostgreSQL Row Level Security on knowledge tables using `SET LOCAL app.user_id/app.org_id` per request.

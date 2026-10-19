import { PERMISSIONS } from './permissions.js';
import type { Permission } from './permissions.js';

export const ROLE_KEYS = ['SUPER_ADMIN', 'ADMIN', 'USER', 'ORG_ADMIN', 'ORG_MEMBER'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

/** Default grants seeded into `role_permissions` (docs/14 matrix). */
export const ROLE_PERMISSIONS: Readonly<Record<RoleKey, readonly Permission[]>> = {
  SUPER_ADMIN: PERMISSIONS,
  ADMIN: [
    'users.read',
    'users.update',
    'users.activate',
    'orgs.read',
    'orgs.create',
    'orgs.activate',
    'billing.read.all',
    'kb.read',
    'interpreter.use',
    'usage.read.all',
    'audit.read',
  ],
  USER: [
    'billing.read.own',
    'billing.manage.own',
    'kb.read',
    'kb.write',
    'kb.share',
    'interpreter.use',
    'usage.read.own',
  ],
  ORG_ADMIN: [
    'orgs.read',
    'orgs.update',
    'org.members.read',
    'org.members.manage',
    'org.settings.manage',
    'org.billing.manage',
    'org.quota.manage',
    'billing.read.own',
    'billing.manage.own',
    'kb.read',
    'kb.write',
    'kb.share',
    'interpreter.use',
    'usage.read.own',
    'usage.read.all',
    'audit.read',
  ],
  ORG_MEMBER: ['kb.read', 'interpreter.use', 'usage.read.own'],
};

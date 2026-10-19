import { ROLE_PERMISSIONS } from '@meetx/shared';
import { describe, expect, it } from 'vitest';

import { buildActor, can, permissionsFor } from './policy.js';
import type { Actor } from './policy.js';

const ORG = '00000000-0000-0000-0000-0000000000a1';
const OTHER_ORG = '00000000-0000-0000-0000-0000000000a2';

type Kind = 'super' | 'admin' | 'user' | 'orgAdmin' | 'orgMember';

function make(kind: Kind, overrides: Parameters<typeof buildActor>[0]['overrides'] = []): Actor {
  const platformRole = kind === 'super' ? 'SUPER_ADMIN' : kind === 'admin' ? 'ADMIN' : 'USER';
  const orgRole = kind === 'orgAdmin' ? 'ORG_ADMIN' : kind === 'orgMember' ? 'ORG_MEMBER' : undefined;
  return buildActor({
    id: kind,
    email: `${kind}@example.com`,
    platformRole,
    status: 'ACTIVE',
    rolePermissions: ROLE_PERMISSIONS,
    memberships: orgRole
      ? [{ organizationId: ORG, orgRole, isOwner: false, membershipActive: true, organizationActive: true }]
      : [],
    overrides,
  });
}

const kinds: Kind[] = ['super', 'admin', 'user', 'orgAdmin', 'orgMember'];

// Rows follow the docs/14 matrix: [permission, organizationId, allowed kinds].
const matrix: Array<[string, string | undefined, Kind[]]> = [
  ['users.read', undefined, ['super', 'admin']],
  ['users.create', undefined, ['super']],
  ['users.update', undefined, ['super', 'admin']],
  ['users.delete', undefined, ['super']],
  ['users.assign_role', undefined, ['super']],
  ['admins.create', undefined, ['super']],
  ['permissions.grant', undefined, ['super']],
  ['orgs.create', undefined, ['super', 'admin']],
  ['orgs.delete', undefined, ['super']],
  ['org.members.manage', ORG, ['super', 'orgAdmin']],
  ['org.members.read', ORG, ['super', 'orgAdmin']],
  ['org.quota.manage', ORG, ['super', 'orgAdmin']],
  ['org.members.manage', OTHER_ORG, ['super']],
  ['system.settings.manage', undefined, ['super']],
  ['kb.write', undefined, ['super', 'user', 'orgAdmin', 'orgMember']],
  ['org.billing.manage', ORG, ['super', 'orgAdmin']],
  ['interpreter.use', undefined, kinds],
];

describe('RBAC matrix', () => {
  for (const [permission, organizationId, allowed] of matrix) {
    for (const kind of kinds) {
      const expected = allowed.includes(kind);
      it(`${kind} ${expected ? 'may' : 'may not'} ${permission}${organizationId ? ` in ${organizationId.slice(-2)}` : ''}`, () => {
        expect(can(make(kind), permission, { organizationId })).toBe(expected);
      });
    }
  }
});

describe('role hierarchy', () => {
  const target = (role: 'SUPER_ADMIN' | 'ADMIN' | 'USER', id = 'target') => ({
    id,
    platformRole: role,
    status: 'ACTIVE' as const,
  });

  it('admin cannot update another admin or a super admin', () => {
    expect(can(make('admin'), 'users.update', { targetUser: target('ADMIN') })).toBe(false);
    expect(can(make('admin'), 'users.update', { targetUser: target('SUPER_ADMIN') })).toBe(false);
    expect(can(make('admin'), 'users.update', { targetUser: target('USER') })).toBe(true);
  });

  it('super admin cannot act on a peer super admin when fewer than two are active', () => {
    const resource = { targetUser: target('SUPER_ADMIN') };
    expect(can(make('super'), 'users.delete', { ...resource, activeSuperAdminCount: 1 })).toBe(false);
    expect(can(make('super'), 'users.delete', { ...resource, activeSuperAdminCount: 2 })).toBe(true);
  });

  it('blocks self-targeting for delete, activation and role changes', () => {
    const self = { targetUser: { id: 'super', platformRole: 'SUPER_ADMIN' as const, status: 'ACTIVE' as const }, activeSuperAdminCount: 5 };
    expect(can(make('super'), 'users.delete', self)).toBe(false);
    expect(can(make('super'), 'users.assign_role', self)).toBe(false);
    expect(can(make('super'), 'users.activate', self)).toBe(false);
  });

  it('org admin cannot manage themselves or the owner', () => {
    const orgAdmin = make('orgAdmin');
    expect(
      can(orgAdmin, 'org.members.manage', {
        organizationId: ORG,
        targetMember: { userId: 'orgAdmin', orgRole: 'ORG_ADMIN', isOwner: false },
      }),
    ).toBe(false);
    expect(
      can(orgAdmin, 'org.members.manage', {
        organizationId: ORG,
        targetMember: { userId: 'someone', orgRole: 'ORG_ADMIN', isOwner: true },
      }),
    ).toBe(false);
    expect(
      can(orgAdmin, 'org.members.manage', {
        organizationId: ORG,
        targetMember: { userId: 'someone', orgRole: 'ORG_MEMBER', isOwner: false },
      }),
    ).toBe(true);
  });
});

describe('overrides and account state', () => {
  it('DENY wins over ALLOW and role grants', () => {
    const actor = make('admin', [
      { permissionKey: 'audit.read', effect: 'ALLOW' },
      { permissionKey: 'audit.read', effect: 'DENY' },
      { permissionKey: 'plans.manage', effect: 'ALLOW' },
    ]);
    expect(can(actor, 'audit.read')).toBe(false);
    expect(can(actor, 'plans.manage')).toBe(true);
  });

  it('ignores memberships that are inactive or belong to inactive organizations', () => {
    const actor = buildActor({
      id: 'u',
      email: 'u@example.com',
      platformRole: 'USER',
      status: 'ACTIVE',
      rolePermissions: ROLE_PERMISSIONS,
      memberships: [
        { organizationId: ORG, orgRole: 'ORG_ADMIN', isOwner: false, membershipActive: false, organizationActive: true },
        { organizationId: OTHER_ORG, orgRole: 'ORG_ADMIN', isOwner: false, membershipActive: true, organizationActive: false },
      ],
      overrides: [],
    });
    expect(can(actor, 'org.members.manage', { organizationId: ORG })).toBe(false);
    expect(can(actor, 'org.members.manage', { organizationId: OTHER_ORG })).toBe(false);
  });

  it.each(['PENDING', 'INACTIVE', 'SUSPENDED'] as const)('denies everything for %s accounts', (status) => {
    const actor = buildActor({
      id: 'u',
      email: 'u@example.com',
      platformRole: 'SUPER_ADMIN',
      status,
      rolePermissions: ROLE_PERMISSIONS,
      memberships: [],
      overrides: [],
    });
    expect(can(actor, 'users.read')).toBe(false);
    expect(permissionsFor(actor)).toEqual([]);
  });
});

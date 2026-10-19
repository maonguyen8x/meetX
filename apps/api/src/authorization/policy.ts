import type { OrganizationRole, PlatformRole } from '@meetx/shared';

export type AccountStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface ActorMembership {
  organizationId: string;
  orgRole: OrganizationRole;
  isOwner: boolean;
}

/** Effective permissions already merge role grants with ALLOW/DENY overrides (DENY wins). */
export interface Actor {
  id: string;
  email: string;
  platformRole: PlatformRole;
  status: AccountStatus;
  mustChangePassword: boolean;
  platformPermissions: ReadonlySet<string>;
  /** Only ACTIVE memberships of ACTIVE organizations are present (docs/14 rules 5 and 6). */
  orgPermissions: ReadonlyMap<string, ReadonlySet<string>>;
  memberships: readonly ActorMembership[];
}

export interface PolicyResource {
  organizationId?: string;
  ownerUserId?: string;
  targetUser?: { id: string; platformRole: PlatformRole; status: AccountStatus };
  targetMember?: { userId: string; orgRole: OrganizationRole; isOwner: boolean };
  activeSuperAdminCount?: number;
}

export interface BuildActorInput {
  id: string;
  email: string;
  platformRole: PlatformRole;
  status: AccountStatus;
  mustChangePassword?: boolean;
  rolePermissions: Readonly<Record<string, readonly string[]>>;
  memberships: ReadonlyArray<{
    organizationId: string;
    orgRole: OrganizationRole;
    isOwner: boolean;
    membershipActive: boolean;
    organizationActive: boolean;
  }>;
  overrides: ReadonlyArray<{ permissionKey: string; effect: 'ALLOW' | 'DENY' }>;
}

const RANK: Record<PlatformRole, number> = { SUPER_ADMIN: 3, ADMIN: 2, USER: 1 };

const USER_TARGET_PERMISSIONS = new Set([
  'users.update',
  'users.delete',
  'users.activate',
  'users.assign_role',
  'permissions.grant',
]);

const NO_SELF_TARGET_PERMISSIONS = new Set([
  'users.delete',
  'users.activate',
  'users.assign_role',
  'permissions.grant',
]);

function applyOverrides(
  base: readonly string[],
  overrides: BuildActorInput['overrides'],
): Set<string> {
  const effective = new Set(base);
  for (const override of overrides) {
    if (override.effect === 'ALLOW') effective.add(override.permissionKey);
  }
  for (const override of overrides) {
    if (override.effect === 'DENY') effective.delete(override.permissionKey);
  }
  return effective;
}

export function buildActor(input: BuildActorInput): Actor {
  const platformPermissions = applyOverrides(
    input.rolePermissions[input.platformRole] ?? [],
    input.overrides,
  );
  const orgPermissions = new Map<string, ReadonlySet<string>>();
  const memberships: ActorMembership[] = [];

  for (const membership of input.memberships) {
    if (!membership.membershipActive || !membership.organizationActive) continue;
    memberships.push({
      organizationId: membership.organizationId,
      orgRole: membership.orgRole,
      isOwner: membership.isOwner,
    });
    orgPermissions.set(
      membership.organizationId,
      applyOverrides(input.rolePermissions[membership.orgRole] ?? [], input.overrides),
    );
  }

  return {
    id: input.id,
    email: input.email,
    platformRole: input.platformRole,
    status: input.status,
    mustChangePassword: input.mustChangePassword ?? false,
    platformPermissions,
    orgPermissions,
    memberships,
  };
}

export function hasPermission(
  actor: Actor,
  permission: string,
  organizationId?: string,
): boolean {
  if (actor.status !== 'ACTIVE') return false;
  if (actor.platformPermissions.has(permission)) return true;
  if (!organizationId) return false;
  return actor.orgPermissions.get(organizationId)?.has(permission) ?? false;
}

export function can(actor: Actor, permission: string, resource: PolicyResource = {}): boolean {
  if (!hasPermission(actor, permission, resource.organizationId)) return false;

  const { targetUser } = resource;
  if (targetUser && USER_TARGET_PERMISSIONS.has(permission)) {
    if (targetUser.id === actor.id) {
      return !NO_SELF_TARGET_PERMISSIONS.has(permission);
    }
    const actorRank = RANK[actor.platformRole];
    const targetRank = RANK[targetUser.platformRole];
    if (actorRank < targetRank) return false;
    if (actorRank === targetRank) {
      const peerSuperAdmin = actor.platformRole === 'SUPER_ADMIN';
      if (!peerSuperAdmin) return false;
      const reactivation = permission === 'users.activate' && targetUser.status !== 'ACTIVE';
      if (!reactivation && (resource.activeSuperAdminCount ?? 0) < 2) return false;
    }
  }

  const { targetMember } = resource;
  if (targetMember && permission === 'org.members.manage') {
    if (targetMember.userId === actor.id) return false;
    if (targetMember.isOwner && !actor.platformPermissions.has(permission)) return false;
  }

  return true;
}

export function permissionsFor(actor: Actor, organizationId?: string): string[] {
  const result = new Set(actor.status === 'ACTIVE' ? actor.platformPermissions : []);
  if (actor.status === 'ACTIVE' && organizationId) {
    for (const key of actor.orgPermissions.get(organizationId) ?? []) result.add(key);
  }
  return [...result].sort();
}

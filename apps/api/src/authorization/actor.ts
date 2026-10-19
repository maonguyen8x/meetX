import type { OrganizationRole, PlatformRole } from '@meetx/shared';

import { prisma } from '../db/prisma.js';
import { buildActor } from './policy.js';
import type { Actor } from './policy.js';

export async function loadActor(userId: string): Promise<Actor | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      platformRole: true,
      status: true,
      mustChangePassword: true,
      permissionOverrides: { select: { permissionKey: true, effect: true } },
      memberships: {
        select: {
          organizationId: true,
          orgRole: true,
          status: true,
          organization: { select: { status: true, ownerUserId: true, deletedAt: true } },
        },
      },
    },
  });
  if (!user) return null;

  const roles = new Set<string>([
    user.platformRole,
    ...user.memberships.map((membership) => membership.orgRole),
  ]);
  const grants = await prisma.rolePermission.findMany({
    where: { role: { in: [...roles] } },
    select: { role: true, permissionKey: true },
  });
  const rolePermissions: Record<string, string[]> = {};
  for (const grant of grants) {
    (rolePermissions[grant.role] ??= []).push(grant.permissionKey);
  }

  return buildActor({
    id: user.id,
    email: user.email,
    platformRole: user.platformRole as PlatformRole,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    rolePermissions,
    overrides: user.permissionOverrides,
    memberships: user.memberships.map((membership) => ({
      organizationId: membership.organizationId,
      orgRole: membership.orgRole as OrganizationRole,
      isOwner: membership.organization.ownerUserId === user.id,
      membershipActive: membership.status === 'ACTIVE',
      organizationActive:
        membership.organization.status === 'ACTIVE' && membership.organization.deletedAt === null,
    })),
  });
}

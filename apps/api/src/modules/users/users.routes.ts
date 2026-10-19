import type { FastifyInstance } from 'fastify';
import { updateProfileSchema } from '@meetx/shared/schemas/auth';

import { permissionsFor } from '../../authorization/policy.js';
import { requireAuthenticatedAllowPending } from '../../authorization/guards.js';
import { prisma } from '../../db/prisma.js';
import { requireActor } from '../../plugins/auth.js';
import { parse } from '../../utils/validate.js';
import { auditContextFrom, writeAudit } from '../audit/audit.service.js';

const profileSelect = {
  id: true,
  email: true,
  name: true,
  locale: true,
  avatarUrl: true,
  platformRole: true,
  status: true,
  emailVerifiedAt: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

export function registerUserRoutes(app: FastifyInstance): void {
  app.get('/v1/me', { preHandler: requireAuthenticatedAllowPending }, async (request) => {
    const actor = requireActor(request);
    const [user, organizations] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: profileSelect }),
      prisma.organization.findMany({
        where: { id: { in: actor.memberships.map((membership) => membership.organizationId) } },
        select: { id: true, name: true, slug: true },
      }),
    ]);
    const names = new Map(organizations.map((organization) => [organization.id, organization]));

    return {
      user,
      permissions: permissionsFor(actor),
      memberships: actor.memberships.map((membership) => ({
        organizationId: membership.organizationId,
        name: names.get(membership.organizationId)?.name ?? '',
        slug: names.get(membership.organizationId)?.slug ?? '',
        orgRole: membership.orgRole,
        isOwner: membership.isOwner,
        permissions: permissionsFor(actor, membership.organizationId),
      })),
    };
  });

  app.patch('/v1/me', { preHandler: requireAuthenticatedAllowPending }, async (request) => {
    const actor = requireActor(request);
    const input = parse(updateProfileSchema, request.body);
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id: actor.id }, data: input, select: profileSelect });
      await writeAudit(
        auditContextFrom(request),
        {
          action: 'user.update_profile',
          targetType: 'user',
          targetId: actor.id,
          metadata: { fields: Object.keys(input) },
        },
        tx,
      );
      return { user };
    });
  });
}

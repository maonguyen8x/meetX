import type { FastifyInstance } from 'fastify';
import {
  adminUpdateUserSchema,
  changeRoleSchema,
  createUserSchema,
  deactivateUserSchema,
  deleteUserSchema,
  listAuditLogsQuerySchema,
  listUsersQuerySchema,
  permissionOverrideSchema,
} from '@meetx/shared/schemas/user';
import type { Prisma } from '@prisma/client';

import { can } from '../../authorization/policy.js';
import { requireAuthenticated } from '../../authorization/guards.js';
import { prisma } from '../../db/prisma.js';
import { requireActor } from '../../plugins/auth.js';
import { forbidden } from '../../utils/app-errors.js';
import { parse, uuidSchema } from '../../utils/validate.js';
import { auditContextFrom } from '../audit/audit.service.js';
import type { AdminUsersService } from './admin-users.service.js';

export function registerAdminRoutes(app: FastifyInstance, users: AdminUsersService): void {
  const guard = { preHandler: requireAuthenticated };
  const id = (request: { params: unknown }) => parse(uuidSchema, (request.params as { id: string }).id);

  app.get('/v1/admin/users', guard, async (request) =>
    users.list(requireActor(request), parse(listUsersQuerySchema, request.query)),
  );

  app.get('/v1/admin/users/:id', guard, async (request) => users.get(requireActor(request), id(request)));

  app.post('/v1/admin/users', guard, async (request, reply) => {
    const user = await users.createAccount(
      requireActor(request),
      auditContextFrom(request),
      parse(createUserSchema, request.body),
      'USER',
    );
    return reply.status(201).send({ user });
  });

  app.post('/v1/admin/admins', guard, async (request, reply) => {
    const user = await users.createAccount(
      requireActor(request),
      auditContextFrom(request),
      parse(createUserSchema, request.body),
      'ADMIN',
    );
    return reply.status(201).send({ user });
  });

  app.patch('/v1/admin/users/:id', guard, async (request) => ({
    user: await users.update(
      requireActor(request),
      auditContextFrom(request),
      id(request),
      parse(adminUpdateUserSchema, request.body),
    ),
  }));

  app.post('/v1/admin/users/:id/deactivate', guard, async (request) => ({
    user: await users.deactivate(
      requireActor(request),
      auditContextFrom(request),
      id(request),
      parse(deactivateUserSchema, request.body ?? {}),
    ),
  }));

  app.post('/v1/admin/users/:id/activate', guard, async (request) => ({
    user: await users.activate(requireActor(request), auditContextFrom(request), id(request)),
  }));

  app.post('/v1/admin/users/:id/role', guard, async (request) => {
    const { role, currentPassword } = parse(changeRoleSchema, request.body);
    return {
      user: await users.changeRole(
        requireActor(request),
        auditContextFrom(request),
        id(request),
        role,
        currentPassword,
      ),
    };
  });

  app.post('/v1/admin/users/:id/permissions', guard, async (request, reply) => {
    const { permissionKey, effect, currentPassword } = parse(permissionOverrideSchema, request.body);
    await users.setPermissionOverride(
      requireActor(request),
      auditContextFrom(request),
      id(request),
      permissionKey,
      effect,
      currentPassword,
    );
    return reply.status(204).send();
  });

  app.post('/v1/admin/users/:id/reset-password', guard, async (request, reply) => {
    await users.sendPasswordReset(requireActor(request), auditContextFrom(request), id(request));
    return reply.status(202).send({ status: 'accepted' });
  });

  app.post('/v1/admin/users/:id/force-logout', guard, async (request, reply) => {
    await users.forceLogout(requireActor(request), auditContextFrom(request), id(request));
    return reply.status(204).send();
  });

  app.delete('/v1/admin/users/:id', guard, async (request, reply) => {
    const { currentPassword } = parse(deleteUserSchema, request.body);
    await users.remove(requireActor(request), auditContextFrom(request), id(request), currentPassword);
    return reply.status(204).send();
  });

  app.get('/v1/admin/audit-logs', guard, async (request) => {
    const actor = requireActor(request);
    if (!can(actor, 'audit.read')) throw forbidden();
    const query = parse(listAuditLogsQuerySchema, request.query);
    // Admins only see their own actions and user/organization/session targets.
    const scope: Prisma.AuditLogWhereInput =
      actor.platformRole === 'SUPER_ADMIN'
        ? {}
        : {
            OR: [
              { actorUserId: actor.id },
              { targetType: { in: ['user', 'organization', 'session'] } },
            ],
          };
    const where: Prisma.AuditLogWhereInput = {
      AND: [
        scope,
        {
          ...(query.action ? { action: query.action } : {}),
          ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
          ...(query.organizationId ? { organizationId: query.organizationId } : {}),
        },
      ],
    };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  });
}

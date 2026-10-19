import type { Prisma } from '@prisma/client';
import type { PlatformRole } from '@meetx/shared';
import type {
  adminUpdateUserSchema,
  createUserSchema,
  listUsersQuerySchema,
} from '@meetx/shared/schemas/user';
import type { z } from 'zod';

import { can } from '../../authorization/policy.js';
import type { Actor, PolicyResource } from '../../authorization/policy.js';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/errors.js';
import { forbidden, isUniqueViolation, notFound } from '../../utils/app-errors.js';
import { writeAudit } from '../audit/audit.service.js';
import type { AuditContext } from '../audit/audit.service.js';
import type { AuthService } from '../auth/auth.service.js';
import { provisionUserDefaults } from '../users/provisioning.js';

const userSelect = {
  id: true,
  email: true,
  name: true,
  locale: true,
  platformRole: true,
  status: true,
  accountType: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  deactivatedAt: true,
  deactivationReason: true,
  createdAt: true,
} as const;

type TargetUser = NonNullable<PolicyResource['targetUser']>;

export async function countActiveSuperAdmins(client: Pick<Prisma.TransactionClient, 'user'> = prisma) {
  return client.user.count({
    where: { platformRole: 'SUPER_ADMIN', status: 'ACTIVE', deletedAt: null },
  });
}

/** Locks all active Super Admin rows so concurrent demotions cannot both succeed. */
export async function assertNotLastActiveSuperAdmin(
  tx: Prisma.TransactionClient,
  target: TargetUser,
): Promise<void> {
  if (target.platformRole !== 'SUPER_ADMIN' || target.status !== 'ACTIVE') return;
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM users
    WHERE platform_role = 'SUPER_ADMIN' AND status = 'ACTIVE' AND deleted_at IS NULL
    FOR UPDATE`;
  if (!rows.some((row) => row.id !== target.id)) {
    throw new AppError('LAST_SUPER_ADMIN', 'The last active Super Admin cannot be changed.', 409);
  }
}

export function createAdminUsersService(auth: AuthService) {
  async function loadTarget(id: string) {
    const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: userSelect });
    if (!user) throw notFound('User not found.');
    return user;
  }

  async function authorizeTarget(actor: Actor, permission: string, target: TargetUser): Promise<void> {
    const activeSuperAdminCount =
      target.platformRole === 'SUPER_ADMIN' ? await countActiveSuperAdmins() : undefined;
    if (!can(actor, permission, { targetUser: target, activeSuperAdminCount })) throw forbidden();
  }

  async function list(actor: Actor, query: z.output<typeof listUsersQuerySchema>) {
    if (!can(actor, 'users.read')) throw forbidden();
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.role ? { platformRole: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: 'insensitive' } },
              { name: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.user.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async function get(actor: Actor, id: string) {
    if (!can(actor, 'users.read')) throw forbidden();
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...userSelect,
        memberships: {
          select: {
            orgRole: true,
            status: true,
            organization: { select: { id: true, name: true, status: true } },
          },
        },
        permissionOverrides: { select: { permissionKey: true, effect: true } },
      },
    });
    if (!user) throw notFound('User not found.');
    return user;
  }

  async function createAccount(
    actor: Actor,
    ctx: AuditContext,
    input: z.output<typeof createUserSchema>,
    role: 'USER' | 'ADMIN',
  ) {
    if (!can(actor, role === 'ADMIN' ? 'admins.create' : 'users.create')) throw forbidden();
    try {
      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: input.email,
            name: input.name,
            locale: input.locale,
            platformRole: role,
            status: 'PENDING',
            createdById: actor.id,
          },
          select: userSelect,
        });
        await provisionUserDefaults(tx, created.id, created.email);
        await writeAudit(
          ctx,
          {
            action: role === 'ADMIN' ? 'admin.create' : 'user.create',
            targetType: 'user',
            targetId: created.id,
            metadata: { role },
          },
          tx,
        );
        return created;
      });
      await auth.sendSetPasswordEmail(user.id, user.email, user.locale);
      return user;
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError('EMAIL_TAKEN', 'Email is already in use.', 409);
      throw error;
    }
  }

  async function update(
    actor: Actor,
    ctx: AuditContext,
    id: string,
    input: z.output<typeof adminUpdateUserSchema>,
  ) {
    const target = await loadTarget(id);
    await authorizeTarget(actor, 'users.update', target);
    if (input.email && actor.platformRole !== 'SUPER_ADMIN') throw forbidden();
    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.update({ where: { id }, data: input, select: userSelect });
        await writeAudit(
          ctx,
          { action: 'user.update', targetType: 'user', targetId: id, metadata: { fields: Object.keys(input) } },
          tx,
        );
        return user;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError('EMAIL_TAKEN', 'Email is already in use.', 409);
      throw error;
    }
  }

  async function deactivate(
    actor: Actor,
    ctx: AuditContext,
    id: string,
    input: { reason?: string; status: 'INACTIVE' | 'SUSPENDED' },
  ) {
    const target = await loadTarget(id);
    await authorizeTarget(actor, 'users.activate', target);
    return prisma.$transaction(async (tx) => {
      await assertNotLastActiveSuperAdmin(tx, target);
      const user = await tx.user.update({
        where: { id },
        data: {
          status: input.status,
          deactivatedAt: new Date(),
          deactivatedById: actor.id,
          deactivationReason: input.reason,
        },
        select: userSelect,
      });
      // Rule 5: deactivation revokes every session at once.
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await writeAudit(
        ctx,
        { action: 'user.deactivate', targetType: 'user', targetId: id, metadata: { status: input.status } },
        tx,
      );
      return user;
    });
  }

  async function activate(actor: Actor, ctx: AuditContext, id: string) {
    const target = await loadTarget(id);
    await authorizeTarget(actor, 'users.activate', target);
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          status: target.emailVerifiedAt ? 'ACTIVE' : 'PENDING',
          deactivatedAt: null,
          deactivatedById: null,
          deactivationReason: null,
        },
        select: userSelect,
      });
      await writeAudit(ctx, { action: 'user.activate', targetType: 'user', targetId: id }, tx);
      return user;
    });
  }

  async function changeRole(
    actor: Actor,
    ctx: AuditContext,
    id: string,
    role: PlatformRole,
    currentPassword: string,
  ) {
    const target = await loadTarget(id);
    await authorizeTarget(actor, 'users.assign_role', target);
    if ((role === 'ADMIN' || role === 'SUPER_ADMIN') && !can(actor, 'admins.create')) throw forbidden();
    await auth.requireReauth(actor.id, currentPassword, ctx.ip);
    return prisma.$transaction(async (tx) => {
      if (role !== 'SUPER_ADMIN') await assertNotLastActiveSuperAdmin(tx, target);
      const user = await tx.user.update({ where: { id }, data: { platformRole: role }, select: userSelect });
      await writeAudit(
        ctx,
        { action: 'user.change_role', targetType: 'user', targetId: id, metadata: { from: target.platformRole, to: role } },
        tx,
      );
      return user;
    });
  }

  async function setPermissionOverride(
    actor: Actor,
    ctx: AuditContext,
    id: string,
    permissionKey: string,
    effect: 'ALLOW' | 'DENY' | 'CLEAR',
    currentPassword: string,
  ) {
    const target = await loadTarget(id);
    await authorizeTarget(actor, 'permissions.grant', target);
    await auth.requireReauth(actor.id, currentPassword, ctx.ip);
    await prisma.$transaction(async (tx) => {
      if (effect === 'CLEAR') {
        await tx.userPermissionOverride.deleteMany({ where: { userId: id, permissionKey } });
      } else {
        await tx.userPermissionOverride.upsert({
          where: { userId_permissionKey: { userId: id, permissionKey } },
          create: { userId: id, permissionKey, effect, grantedById: actor.id },
          update: { effect, grantedById: actor.id },
        });
      }
      await writeAudit(
        ctx,
        { action: 'user.permission_override', targetType: 'user', targetId: id, metadata: { permissionKey, effect } },
        tx,
      );
    });
  }

  async function remove(actor: Actor, ctx: AuditContext, id: string, currentPassword: string) {
    const target = await loadTarget(id);
    await authorizeTarget(actor, 'users.delete', target);
    await auth.requireReauth(actor.id, currentPassword, ctx.ip);
    await prisma.$transaction(async (tx) => {
      await assertNotLastActiveSuperAdmin(tx, target);
      const owned = await tx.organization.count({ where: { ownerUserId: id, deletedAt: null } });
      if (owned > 0) {
        throw new AppError('USER_OWNS_ORGANIZATION', 'Transfer or delete the user\'s organizations first.', 409);
      }
      await tx.user.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await writeAudit(ctx, { action: 'user.delete', targetType: 'user', targetId: id }, tx);
    });
  }

  async function sendPasswordReset(actor: Actor, ctx: AuditContext, id: string) {
    const target = await loadTarget(id);
    await authorizeTarget(actor, 'users.update', target);
    await auth.sendSetPasswordEmail(id, target.email, target.locale);
    await writeAudit(ctx, { action: 'user.reset_password', targetType: 'user', targetId: id });
  }

  async function forceLogout(actor: Actor, ctx: AuditContext, id: string) {
    const target = await loadTarget(id);
    await authorizeTarget(actor, 'users.update', target);
    await prisma.$transaction(async (tx) => {
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await writeAudit(ctx, { action: 'user.force_logout', targetType: 'user', targetId: id }, tx);
    });
  }

  return {
    list,
    get,
    createAccount,
    update,
    deactivate,
    activate,
    changeRole,
    setPermissionOverride,
    remove,
    sendPasswordReset,
    forceLogout,
  };
}

export type AdminUsersService = ReturnType<typeof createAdminUsersService>;

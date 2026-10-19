import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type {
  acceptInvitationSchema,
  adminCreateOrganizationSchema,
  adminUpdateOrganizationSchema,
  createOrganizationSchema,
  inviteMemberSchema,
  memberQuotaSchema,
  updateMemberSchema,
  updateOrganizationSchema,
} from '@meetx/shared/schemas/org';

import { can } from '../../authorization/policy.js';
import type { Actor } from '../../authorization/policy.js';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import type { EmailProvider } from '../../providers/email/email.provider.js';
import { buildEmail } from '../../providers/email/templates.js';
import { forbidden, notFound } from '../../utils/app-errors.js';
import { generateToken, hashToken } from '../../utils/crypto.js';
import { AppError } from '../../utils/errors.js';
import { uniqueSlug } from '../../utils/slug.js';
import { writeAudit } from '../audit/audit.service.js';
import type { AuditContext } from '../audit/audit.service.js';
import { hashPassword } from '../auth/auth.service.js';
import type { AuthService } from '../auth/auth.service.js';
import { provisionOrganizationBilling, provisionUserDefaults } from '../users/provisioning.js';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const orgSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  ownerUserId: true,
  billingEmail: true,
  taxCode: true,
  address: true,
  logoUrl: true,
  maxMembers: true,
  createdAt: true,
} as const;

export interface OrganizationsDeps {
  auth: AuthService;
  mailer: EmailProvider;
}

export function createOrganizationsService({ auth, mailer }: OrganizationsDeps) {
  async function loadOrg(id: string) {
    const organization = await prisma.organization.findFirst({
      where: { id, deletedAt: null },
      select: orgSelect,
    });
    if (!organization) throw notFound('Organization not found.');
    return organization;
  }

  /** Members of the organization get "not found" instead of "forbidden" to avoid leaking existence. */
  async function loadOrgFor(actor: Actor, id: string, permission: string) {
    const organization = await loadOrg(id);
    const isMember = actor.memberships.some((membership) => membership.organizationId === id);
    if (!can(actor, permission, { organizationId: id })) {
      if (!isMember && !can(actor, 'orgs.read')) throw notFound('Organization not found.');
      throw forbidden();
    }
    return organization;
  }

  async function createSelf(
    actor: Actor,
    ctx: AuditContext,
    input: z.output<typeof createOrganizationSchema>,
  ) {
    if (actor.platformRole !== 'USER' || actor.status !== 'ACTIVE') throw forbidden();
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: input.name,
          slug: uniqueSlug(input.name),
          ownerUserId: actor.id,
          billingEmail: input.billingEmail ?? actor.email,
          taxCode: input.taxCode,
          address: input.address,
          members: {
            create: { userId: actor.id, orgRole: 'ORG_ADMIN', status: 'ACTIVE', joinedAt: new Date() },
          },
        },
        select: orgSelect,
      });
      await provisionOrganizationBilling(tx, organization.id, organization.billingEmail);
      await writeAudit(
        ctx,
        { action: 'org.create', targetType: 'organization', targetId: organization.id, organizationId: organization.id },
        tx,
      );
      return organization;
    });
  }

  async function adminCreate(
    actor: Actor,
    ctx: AuditContext,
    input: z.output<typeof adminCreateOrganizationSchema>,
  ) {
    if (!can(actor, 'orgs.create')) throw forbidden();
    let ownerToNotify: { id: string; email: string; locale: string } | undefined;
    const organization = await prisma.$transaction(async (tx) => {
      let owner = await tx.user.findFirst({
        where: { email: input.ownerEmail, deletedAt: null },
        select: { id: true, email: true, locale: true },
      });
      if (!owner) {
        owner = await tx.user.create({
          data: {
            email: input.ownerEmail,
            name: input.ownerName ?? input.ownerEmail,
            locale: input.ownerLocale,
            status: 'PENDING',
            accountType: 'ENTERPRISE_MEMBER',
            createdById: actor.id,
          },
          select: { id: true, email: true, locale: true },
        });
        await provisionUserDefaults(tx, owner.id, owner.email);
        ownerToNotify = owner;
      }
      const created = await tx.organization.create({
        data: {
          name: input.name,
          slug: uniqueSlug(input.name),
          ownerUserId: owner.id,
          billingEmail: input.billingEmail ?? owner.email,
          taxCode: input.taxCode,
          address: input.address,
          maxMembers: input.maxMembers,
          members: {
            create: { userId: owner.id, orgRole: 'ORG_ADMIN', status: 'ACTIVE', joinedAt: new Date() },
          },
        },
        select: orgSelect,
      });
      await provisionOrganizationBilling(tx, created.id, created.billingEmail);
      await writeAudit(
        ctx,
        { action: 'org.create', targetType: 'organization', targetId: created.id, organizationId: created.id },
        tx,
      );
      return created;
    });
    if (ownerToNotify) {
      await auth.sendSetPasswordEmail(ownerToNotify.id, ownerToNotify.email, ownerToNotify.locale as 'vi');
    }
    return organization;
  }

  async function list(actor: Actor, page: number, pageSize: number) {
    const all = can(actor, 'orgs.read');
    const ids = actor.memberships.map((membership) => membership.organizationId);
    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
      ...(all ? {} : { id: { in: ids } }),
    };
    const [items, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        select: orgSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.organization.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async function get(actor: Actor, id: string) {
    const organization = await loadOrg(id);
    const isMember = actor.memberships.some((membership) => membership.organizationId === id);
    if (!isMember && !can(actor, 'orgs.read')) throw notFound('Organization not found.');
    return organization;
  }

  async function update(
    actor: Actor,
    ctx: AuditContext,
    id: string,
    input: z.output<typeof updateOrganizationSchema>,
  ) {
    await loadOrgFor(actor, id, 'orgs.update');
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.update({ where: { id }, data: input, select: orgSelect });
      await writeAudit(
        ctx,
        { action: 'org.update', targetType: 'organization', targetId: id, organizationId: id, metadata: { fields: Object.keys(input) } },
        tx,
      );
      return organization;
    });
  }

  async function adminUpdate(
    actor: Actor,
    ctx: AuditContext,
    id: string,
    input: z.output<typeof adminUpdateOrganizationSchema>,
  ) {
    await loadOrg(id);
    if (!can(actor, 'orgs.activate')) throw forbidden();
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.update({ where: { id }, data: input, select: orgSelect });
      await writeAudit(
        ctx,
        { action: 'org.admin_update', targetType: 'organization', targetId: id, organizationId: id, metadata: { fields: Object.keys(input) } },
        tx,
      );
      return organization;
    });
  }

  async function remove(actor: Actor, ctx: AuditContext, id: string, currentPassword: string) {
    await loadOrg(id);
    if (!can(actor, 'orgs.delete', { organizationId: id })) throw forbidden();
    await auth.requireReauth(actor.id, currentPassword, ctx.ip);
    await prisma.$transaction(async (tx) => {
      await tx.organization.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
      await writeAudit(ctx, { action: 'org.delete', targetType: 'organization', targetId: id, organizationId: id }, tx);
    });
  }

  async function listMembers(actor: Actor, id: string) {
    await loadOrgFor(actor, id, 'org.members.read');
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: id },
      select: {
        orgRole: true,
        status: true,
        joinedAt: true,
        user: { select: { id: true, email: true, name: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return { items: members.map((member) => ({ ...member, isOwner: false })) };
  }

  async function invite(
    actor: Actor,
    ctx: AuditContext,
    id: string,
    input: z.output<typeof inviteMemberSchema>,
  ) {
    const organization = await loadOrgFor(actor, id, 'org.members.manage');
    if (organization.status !== 'ACTIVE') throw new AppError('ORG_INACTIVE', 'Organization is not active.', 409);
    await assertSeatAvailable(id, organization.maxMembers);

    const existing = await prisma.organizationMember.findFirst({
      where: { organizationId: id, user: { email: input.email } },
      select: { id: true },
    });
    if (existing) throw new AppError('ALREADY_MEMBER', 'This user is already a member.', 409);

    const token = generateToken(32);
    await prisma.$transaction(async (tx) => {
      await tx.organizationInvitation.updateMany({
        where: { organizationId: id, email: input.email, acceptedAt: null },
        data: { expiresAt: new Date() },
      });
      await tx.organizationInvitation.create({
        data: {
          organizationId: id,
          email: input.email,
          orgRole: input.orgRole,
          tokenHash: hashToken(token),
          invitedById: actor.id,
          expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        },
      });
      await writeAudit(
        ctx,
        { action: 'org.invite', targetType: 'organization', targetId: id, organizationId: id, metadata: { email: input.email, orgRole: input.orgRole } },
        tx,
      );
    });

    const invitee = await prisma.user.findUnique({ where: { email: input.email }, select: { locale: true } });
    const locale = (invitee?.locale ?? 'vi') as 'vi' | 'en' | 'ja';
    const url = `${env.APP_URL}/${locale}/accept-invite?token=${encodeURIComponent(token)}`;
    await mailer.send(buildEmail('invitation', locale, input.email, url));
  }

  async function assertSeatAvailable(
    id: string,
    maxMembers: number | null,
    client: Pick<Prisma.TransactionClient, 'organizationMember'> = prisma,
  ) {
    if (maxMembers === null) return;
    const used = await client.organizationMember.count({
      where: { organizationId: id, status: { in: ['ACTIVE', 'INACTIVE'] } },
    });
    if (used >= maxMembers) throw new AppError('SEAT_LIMIT_REACHED', 'The seat limit has been reached.', 409);
  }

  async function acceptInvitation(
    ctx: AuditContext,
    viewer: Actor | undefined,
    input: z.output<typeof acceptInvitationSchema>,
  ) {
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { tokenHash: hashToken(input.token) },
      include: { organization: { select: { id: true, status: true, maxMembers: true, deletedAt: true } } },
    });
    const invalid = new AppError('INVITATION_INVALID', 'The invitation is invalid or has expired.', 400);
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.expiresAt <= new Date() ||
      invitation.organization.deletedAt ||
      invitation.organization.status !== 'ACTIVE'
    ) {
      throw invalid;
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: invitation.email, deletedAt: null },
      select: { id: true },
    });
    if (existingUser) {
      if (!viewer || viewer.id !== existingUser.id) {
        throw new AppError('LOGIN_REQUIRED', 'Sign in with the invited account to accept.', 401);
      }
    } else if (!input.name || !input.password) {
      throw new AppError('VALIDATION_ERROR', 'Name and password are required.', 400);
    }
    const passwordHash = existingUser ? undefined : await hashPassword(input.password as string);

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.organizationInvitation.updateMany({
        where: { id: invitation.id, acceptedAt: null },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count === 0) throw invalid;
      await assertSeatAvailable(invitation.organizationId, invitation.organization.maxMembers, tx);

      let userId = existingUser?.id;
      if (!userId) {
        const created = await tx.user.create({
          data: {
            email: invitation.email,
            name: input.name as string,
            locale: input.locale,
            passwordHash,
            status: 'ACTIVE',
            accountType: 'ENTERPRISE_MEMBER',
            emailVerifiedAt: new Date(),
          },
          select: { id: true },
        });
        await provisionUserDefaults(tx, created.id, invitation.email);
        userId = created.id;
      }
      await tx.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: invitation.organizationId, userId } },
        create: {
          organizationId: invitation.organizationId,
          userId,
          orgRole: invitation.orgRole,
          status: 'ACTIVE',
          invitedById: invitation.invitedById,
          joinedAt: new Date(),
        },
        update: { orgRole: invitation.orgRole, status: 'ACTIVE', joinedAt: new Date() },
      });
      await writeAudit(
        { ...ctx, actorUserId: userId },
        { action: 'org.invitation_accept', targetType: 'organization', targetId: invitation.organizationId, organizationId: invitation.organizationId },
        tx,
      );
    });
  }

  async function loadMember(organizationId: string, userId: string, ownerUserId: string) {
    const member = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { userId: true, orgRole: true, status: true },
    });
    if (!member) throw notFound('Member not found.');
    return { ...member, isOwner: member.userId === ownerUserId };
  }

  async function updateMember(
    actor: Actor,
    ctx: AuditContext,
    id: string,
    userId: string,
    input: z.output<typeof updateMemberSchema>,
  ) {
    const organization = await loadOrgFor(actor, id, 'org.members.manage');
    const member = await loadMember(id, userId, organization.ownerUserId);
    if (!can(actor, 'org.members.manage', { organizationId: id, targetMember: member })) throw forbidden();
    await prisma.$transaction(async (tx) => {
      await tx.organizationMember.update({
        where: { organizationId_userId: { organizationId: id, userId } },
        data: input,
      });
      await writeAudit(
        ctx,
        { action: 'org.member_update', targetType: 'user', targetId: userId, organizationId: id, metadata: { ...input } },
        tx,
      );
    });
  }

  async function removeMember(actor: Actor, ctx: AuditContext, id: string, userId: string) {
    const organization = await loadOrgFor(actor, id, 'org.members.manage');
    const member = await loadMember(id, userId, organization.ownerUserId);
    if (!can(actor, 'org.members.manage', { organizationId: id, targetMember: member })) throw forbidden();
    if (member.isOwner) throw forbidden('The organization owner cannot be removed.');
    await prisma.$transaction(async (tx) => {
      // Knowledge created by the departing member stays with the organization.
      await tx.folder.updateMany({
        where: { organizationId: id, ownerId: userId },
        data: { ownerId: organization.ownerUserId },
      });
      await tx.document.updateMany({
        where: { organizationId: id, ownerId: userId },
        data: { ownerId: organization.ownerUserId },
      });
      await tx.memberQuota.deleteMany({ where: { organizationId: id, userId } });
      await tx.organizationMember.delete({
        where: { organizationId_userId: { organizationId: id, userId } },
      });
      await writeAudit(
        ctx,
        { action: 'org.member_remove', targetType: 'user', targetId: userId, organizationId: id },
        tx,
      );
    });
  }

  async function setMemberQuotas(
    actor: Actor,
    ctx: AuditContext,
    id: string,
    userId: string,
    input: z.output<typeof memberQuotaSchema>,
  ) {
    await loadOrgFor(actor, id, 'org.quota.manage');
    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: id, userId } },
      select: { id: true },
    });
    if (!membership) throw notFound('Member not found.');
    await prisma.$transaction(async (tx) => {
      for (const quota of input.quotas) {
        await tx.memberQuota.upsert({
          where: { organizationId_userId_metric: { organizationId: id, userId, metric: quota.metric } },
          create: { organizationId: id, userId, metric: quota.metric, limitValue: BigInt(quota.limitValue) },
          update: { limitValue: BigInt(quota.limitValue) },
        });
      }
      await writeAudit(
        ctx,
        { action: 'org.member_quota_set', targetType: 'user', targetId: userId, organizationId: id, metadata: { metrics: input.quotas.map((q) => q.metric) } },
        tx,
      );
    });
  }

  async function listAuditLogs(actor: Actor, id: string, page: number, pageSize: number) {
    await loadOrgFor(actor, id, 'audit.read');
    const where = { organizationId: id };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  return {
    createSelf,
    adminCreate,
    list,
    get,
    update,
    adminUpdate,
    remove,
    listMembers,
    invite,
    acceptInvitation,
    updateMember,
    removeMember,
    setMemberQuotas,
    listAuditLogs,
  };
}

export type OrganizationsService = ReturnType<typeof createOrganizationsService>;

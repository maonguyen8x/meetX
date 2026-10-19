import type { FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';

import { prisma } from '../../db/prisma.js';

export interface AuditContext {
  actorUserId?: string;
  actorRole?: string;
  ip?: string;
  userAgent?: string;
}

export interface AuditEntry {
  action: string;
  targetType: string;
  targetId?: string;
  organizationId?: string;
  metadata?: Prisma.InputJsonObject;
}

type AuditClient = Pick<Prisma.TransactionClient, 'auditLog'>;

export function auditContextFrom(request: FastifyRequest): AuditContext {
  return {
    actorUserId: request.actor?.id,
    actorRole: request.actor?.platformRole,
    ip: request.ip,
    userAgent: request.headers['user-agent']?.slice(0, 300),
  };
}

export async function writeAudit(
  context: AuditContext,
  entry: AuditEntry,
  client: AuditClient = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorUserId: context.actorUserId,
      actorRole: context.actorRole,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      organizationId: entry.organizationId,
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: entry.metadata ?? {},
    },
  });
}

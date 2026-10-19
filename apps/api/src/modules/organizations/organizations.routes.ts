import type { FastifyInstance } from 'fastify';
import {
  acceptInvitationSchema,
  adminCreateOrganizationSchema,
  adminUpdateOrganizationSchema,
  createOrganizationSchema,
  deleteOrganizationSchema,
  inviteMemberSchema,
  memberQuotaSchema,
  updateMemberSchema,
  updateOrganizationSchema,
} from '@meetx/shared/schemas/org';
import { listAuditLogsQuerySchema } from '@meetx/shared/schemas/user';

import { requireAuthenticated } from '../../authorization/guards.js';
import { authenticateRequest, requireActor } from '../../plugins/auth.js';
import { parse, uuidSchema } from '../../utils/validate.js';
import { auditContextFrom } from '../audit/audit.service.js';
import type { OrganizationsService } from './organizations.service.js';

export function registerOrganizationRoutes(app: FastifyInstance, orgs: OrganizationsService): void {
  const guard = { preHandler: requireAuthenticated };
  const param = (request: { params: unknown }, key: string) =>
    parse(uuidSchema, (request.params as Record<string, string>)[key]);
  const paging = (query: unknown) => parse(listAuditLogsQuerySchema, query);

  app.get('/v1/orgs', guard, async (request) => {
    const { page, pageSize } = paging(request.query);
    return orgs.list(requireActor(request), page, pageSize);
  });

  app.post('/v1/orgs', guard, async (request, reply) => {
    const organization = await orgs.createSelf(
      requireActor(request),
      auditContextFrom(request),
      parse(createOrganizationSchema, request.body),
    );
    return reply.status(201).send({ organization });
  });

  app.post('/v1/admin/orgs', guard, async (request, reply) => {
    const organization = await orgs.adminCreate(
      requireActor(request),
      auditContextFrom(request),
      parse(adminCreateOrganizationSchema, request.body),
    );
    return reply.status(201).send({ organization });
  });

  app.get('/v1/orgs/:id', guard, async (request) => ({
    organization: await orgs.get(requireActor(request), param(request, 'id')),
  }));

  app.patch('/v1/orgs/:id', guard, async (request) => ({
    organization: await orgs.update(
      requireActor(request),
      auditContextFrom(request),
      param(request, 'id'),
      parse(updateOrganizationSchema, request.body),
    ),
  }));

  app.patch('/v1/admin/orgs/:id', guard, async (request) => ({
    organization: await orgs.adminUpdate(
      requireActor(request),
      auditContextFrom(request),
      param(request, 'id'),
      parse(adminUpdateOrganizationSchema, request.body),
    ),
  }));

  app.delete('/v1/orgs/:id', guard, async (request, reply) => {
    const { currentPassword } = parse(deleteOrganizationSchema, request.body);
    await orgs.remove(requireActor(request), auditContextFrom(request), param(request, 'id'), currentPassword);
    return reply.status(204).send();
  });

  app.get('/v1/orgs/:id/members', guard, async (request) =>
    orgs.listMembers(requireActor(request), param(request, 'id')),
  );

  app.post('/v1/orgs/:id/invitations', guard, async (request, reply) => {
    await orgs.invite(
      requireActor(request),
      auditContextFrom(request),
      param(request, 'id'),
      parse(inviteMemberSchema, request.body),
    );
    return reply.status(202).send({ status: 'invitation_sent' });
  });

  // Public: new users supply name/password; existing users must be signed in as the invitee.
  app.post(
    '/v1/orgs/invitations/accept',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const input = parse(acceptInvitationSchema, request.body);
      const viewer = request.headers.authorization
        ? await authenticateRequest(request, { allowPasswordChangePending: true })
        : undefined;
      await orgs.acceptInvitation(auditContextFrom(request), viewer, input);
      return reply.status(204).send();
    },
  );

  app.patch('/v1/orgs/:id/members/:userId', guard, async (request, reply) => {
    await orgs.updateMember(
      requireActor(request),
      auditContextFrom(request),
      param(request, 'id'),
      param(request, 'userId'),
      parse(updateMemberSchema, request.body),
    );
    return reply.status(204).send();
  });

  app.delete('/v1/orgs/:id/members/:userId', guard, async (request, reply) => {
    await orgs.removeMember(
      requireActor(request),
      auditContextFrom(request),
      param(request, 'id'),
      param(request, 'userId'),
    );
    return reply.status(204).send();
  });

  app.put('/v1/orgs/:id/members/:userId/quotas', guard, async (request, reply) => {
    await orgs.setMemberQuotas(
      requireActor(request),
      auditContextFrom(request),
      param(request, 'id'),
      param(request, 'userId'),
      parse(memberQuotaSchema, request.body),
    );
    return reply.status(204).send();
  });

  app.get('/v1/orgs/:id/audit-logs', guard, async (request) => {
    const { page, pageSize } = paging(request.query);
    return orgs.listAuditLogs(requireActor(request), param(request, 'id'), page, pageSize);
  });
}

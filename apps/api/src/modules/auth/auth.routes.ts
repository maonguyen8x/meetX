import type { FastifyInstance } from 'fastify';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@meetx/shared/schemas/auth';

import { requireAuthenticated, requireAuthenticatedAllowPending } from '../../authorization/guards.js';
import { requireActor } from '../../plugins/auth.js';
import { parse, uuidSchema } from '../../utils/validate.js';
import { auditContextFrom } from '../audit/audit.service.js';
import type { AuthService } from './auth.service.js';

const strictLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } };

export function registerAuthRoutes(app: FastifyInstance, auth: AuthService): void {
  app.post('/v1/auth/register', { config: strictLimit }, async (request, reply) => {
    const input = parse(registerSchema, request.body);
    await auth.register(input, auditContextFrom(request));
    return reply.status(202).send({ status: 'verification_sent' });
  });

  app.post('/v1/auth/login', { config: strictLimit }, async (request) => {
    const { email, password } = parse(loginSchema, request.body);
    const { tokens, user } = await auth.login(email, password, auditContextFrom(request));
    return { ...tokens, user };
  });

  app.post('/v1/auth/refresh', { config: strictLimit }, async (request) => {
    const { refreshToken } = parse(refreshSchema, request.body);
    return auth.refresh(refreshToken, auditContextFrom(request));
  });

  app.post('/v1/auth/logout', { preHandler: requireAuthenticatedAllowPending }, async (request, reply) => {
    const { refreshToken } = parse(logoutSchema, request.body);
    await auth.logout(refreshToken, request.sessionId);
    return reply.status(204).send();
  });

  app.post('/v1/auth/forgot-password', { config: strictLimit }, async (request, reply) => {
    const { email } = parse(forgotPasswordSchema, request.body);
    await auth.forgotPassword(email);
    return reply.status(202).send({ status: 'accepted' });
  });

  app.post('/v1/auth/reset-password', { config: strictLimit }, async (request, reply) => {
    const { token, password } = parse(resetPasswordSchema, request.body);
    await auth.resetPassword(token, password, auditContextFrom(request));
    return reply.status(204).send();
  });

  app.post('/v1/auth/verify-email', { config: strictLimit }, async (request, reply) => {
    const { token } = parse(verifyEmailSchema, request.body);
    await auth.verifyEmail(token);
    return reply.status(204).send();
  });

  app.post(
    '/v1/auth/change-password',
    { preHandler: requireAuthenticatedAllowPending, config: strictLimit },
    async (request, reply) => {
      const actor = requireActor(request);
      const { currentPassword, newPassword } = parse(changePasswordSchema, request.body);
      await auth.changePassword(
        actor.id,
        request.sessionId,
        currentPassword,
        newPassword,
        auditContextFrom(request),
      );
      return reply.status(204).send();
    },
  );

  app.get('/v1/auth/sessions', { preHandler: requireAuthenticated }, async (request) => {
    const actor = requireActor(request);
    return { sessions: await auth.listSessions(actor.id, request.sessionId) };
  });

  app.delete<{ Params: { id: string } }>(
    '/v1/auth/sessions/:id',
    { preHandler: requireAuthenticated },
    async (request, reply) => {
      const actor = requireActor(request);
      await auth.revokeSession(actor.id, parse(uuidSchema, request.params.id));
      return reply.status(204).send();
    },
  );
}

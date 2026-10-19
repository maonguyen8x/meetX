import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { env } from '../config/env.js';
import { loadActor } from '../authorization/actor.js';
import type { Actor } from '../authorization/policy.js';
import { prisma } from '../db/prisma.js';
import { AppError } from '../utils/errors.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; sid: string };
    user: { sub: string; sid: string };
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    actor?: Actor;
    sessionId?: string;
  }
}

export async function registerAuthPlugin(app: FastifyInstance): Promise<void> {
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: ACCESS_TOKEN_TTL_SECONDS, algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  });
}

export interface AuthenticateOptions {
  allowPasswordChangePending?: boolean;
}

/** Verifies the JWT, then re-checks the session and account on every request so revocation is immediate. */
export async function authenticateRequest(
  request: FastifyRequest,
  options: AuthenticateOptions = {},
): Promise<Actor> {
  try {
    await request.jwtVerify();
  } catch {
    throw new AppError('UNAUTHENTICATED', 'Authentication is required.', 401);
  }

  const { sub, sid } = request.user;
  const session = await prisma.session.findUnique({
    where: { id: sid },
    select: { userId: true, revokedAt: true, expiresAt: true },
  });
  if (!session || session.userId !== sub || session.revokedAt || session.expiresAt <= new Date()) {
    throw new AppError('SESSION_REVOKED', 'This session is no longer valid.', 401);
  }

  const actor = await loadActor(sub);
  if (!actor) throw new AppError('UNAUTHENTICATED', 'Authentication is required.', 401);
  if (actor.status !== 'ACTIVE') {
    throw new AppError('ACCOUNT_INACTIVE', 'This account is not active.', 403);
  }
  if (actor.mustChangePassword && !options.allowPasswordChangePending) {
    throw new AppError('PASSWORD_CHANGE_REQUIRED', 'You must change your password first.', 403);
  }

  request.actor = actor;
  request.sessionId = sid;
  return actor;
}

export function requireActor(request: FastifyRequest): Actor {
  if (!request.actor) throw new AppError('UNAUTHENTICATED', 'Authentication is required.', 401);
  return request.actor;
}

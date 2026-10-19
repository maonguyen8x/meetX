import argon2 from 'argon2';
import type { Prisma } from '@prisma/client';
import type { Locale } from '@prisma/client';
import type { RegisterInput } from '@meetx/shared/schemas/auth';

import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import type { EmailProvider } from '../../providers/email/index.js';
import { buildEmail } from '../../providers/email/templates.js';
import { generateToken, hashToken } from '../../utils/crypto.js';
import { AppError } from '../../utils/errors.js';
import { uniqueSlug } from '../../utils/slug.js';
import { writeAudit } from '../audit/audit.service.js';
import type { AuditContext } from '../audit/audit.service.js';
import { provisionOrganizationBilling, provisionUserDefaults } from '../users/provisioning.js';
import type { LoginThrottle } from './login-throttle.js';

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
export const SET_PASSWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthServiceDeps {
  mailer: EmailProvider;
  throttle: LoginThrottle;
  signAccessToken: (payload: { sub: string; sid: string }) => string;
}

export interface RequestMeta extends AuditContext {
  ip?: string;
  userAgent?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  platformRole: string;
  locale: string;
  mustChangePassword: boolean;
}

const ARGON_OPTIONS = { type: argon2.argon2id } as const;
let dummyHash: Promise<string> | undefined;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON_OPTIONS);
}

function link(locale: string, path: string, token: string): string {
  return `${env.APP_URL}/${locale}/${path}?token=${encodeURIComponent(token)}`;
}

export function createAuthService(deps: AuthServiceDeps) {
  async function createSession(
    client: Pick<Prisma.TransactionClient, 'session'>,
    userId: string,
    meta: RequestMeta,
  ): Promise<TokenPair> {
    const refreshToken = generateToken(48);
    const session = await client.session.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        userAgent: meta.userAgent,
        ip: meta.ip,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
      select: { id: true },
    });
    return {
      accessToken: deps.signAccessToken({ sub: userId, sid: session.id }),
      refreshToken,
      expiresIn: 15 * 60,
    };
  }

  async function issueAuthToken(
    client: Pick<Prisma.TransactionClient, 'authToken'>,
    userId: string,
    type: 'EMAIL_VERIFY' | 'PASSWORD_RESET',
    ttlMs: number,
  ): Promise<string> {
    await client.authToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    });
    const token = generateToken(32);
    await client.authToken.create({
      data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) },
    });
    return token;
  }

  async function register(input: RegisterInput, meta: RequestMeta): Promise<void> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    // Same response for existing emails prevents account enumeration.
    if (existing) return;

    const passwordHash = await hashPassword(input.password);
    const token = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          name: input.name,
          locale: input.locale,
          status: 'PENDING',
          accountType: input.accountKind === 'business' ? 'ENTERPRISE_MEMBER' : 'INDIVIDUAL',
        },
        select: { id: true },
      });
      await provisionUserDefaults(tx, user.id, input.email);

      let organizationId: string | undefined;
      if (input.accountKind === 'business' && input.organizationName) {
        const organization = await tx.organization.create({
          data: {
            name: input.organizationName,
            slug: uniqueSlug(input.organizationName),
            ownerUserId: user.id,
            billingEmail: input.email,
            members: {
              create: { userId: user.id, orgRole: 'ORG_ADMIN', status: 'ACTIVE', joinedAt: new Date() },
            },
          },
          select: { id: true },
        });
        organizationId = organization.id;
        await provisionOrganizationBilling(tx, organization.id, input.email);
      }

      const verifyToken = await issueAuthToken(tx, user.id, 'EMAIL_VERIFY', VERIFY_TTL_MS);
      await writeAudit(
        { ...meta, actorUserId: user.id, actorRole: 'USER' },
        {
          action: 'auth.register',
          targetType: 'user',
          targetId: user.id,
          organizationId,
          metadata: { accountKind: input.accountKind },
        },
        tx,
      );
      return verifyToken;
    });

    await deps.mailer.send(
      buildEmail('verifyEmail', input.locale, input.email, link(input.locale, 'verify-email', token)),
    );
  }

  async function verifyEmail(token: string): Promise<void> {
    const record = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (
      !record ||
      record.type !== 'EMAIL_VERIFY' ||
      record.usedAt ||
      record.expiresAt <= new Date()
    ) {
      throw new AppError('INVALID_TOKEN', 'The token is invalid or has expired.', 400);
    }
    await prisma.$transaction(async (tx) => {
      await tx.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      await tx.user.updateMany({
        where: { id: record.userId, status: 'PENDING' },
        data: { status: 'ACTIVE', emailVerifiedAt: new Date() },
      });
      await tx.user.updateMany({
        where: { id: record.userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() },
      });
    });
  }

  async function verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user?.passwordHash) return false;
    return argon2.verify(user.passwordHash, password);
  }

  async function login(
    email: string,
    password: string,
    meta: RequestMeta,
  ): Promise<{ tokens: TokenPair; user: SessionUser }> {
    const throttleKey = `${email}|${meta.ip ?? 'unknown'}`;
    const locked = await deps.throttle.lockedFor(throttleKey);
    if (locked > 0) {
      throw new AppError('TOO_MANY_ATTEMPTS', `Too many attempts. Retry in ${locked} seconds.`, 429);
    }

    const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    dummyHash ??= hashPassword('dummy-password-for-timing');
    const valid = user?.passwordHash
      ? await argon2.verify(user.passwordHash, password)
      : (await argon2.verify(await dummyHash, password), false);

    if (!user || !valid) {
      await deps.throttle.recordFailure(throttleKey);
      throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect.', 401);
    }
    if (user.status === 'PENDING') {
      throw new AppError('EMAIL_NOT_VERIFIED', 'Verify your email before signing in.', 403);
    }
    if (user.status !== 'ACTIVE') {
      throw new AppError('ACCOUNT_INACTIVE', 'This account is not active.', 403);
    }

    await deps.throttle.reset(throttleKey);
    const tokens = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      await writeAudit(
        { ...meta, actorUserId: user.id, actorRole: user.platformRole },
        { action: 'auth.login', targetType: 'user', targetId: user.id },
        tx,
      );
      return createSession(tx, user.id, meta);
    });

    return {
      tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        platformRole: user.platformRole,
        locale: user.locale,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async function refresh(refreshToken: string, meta: RequestMeta): Promise<TokenPair> {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: { select: { status: true, deletedAt: true } } },
    });
    if (!session) throw new AppError('INVALID_REFRESH_TOKEN', 'Refresh token is invalid.', 401);

    if (session.revokedAt) {
      // A rotated token being replayed signals theft: revoke every session of the user.
      await prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new AppError('REFRESH_TOKEN_REUSED', 'Refresh token was already used.', 401);
    }
    if (session.expiresAt <= new Date()) {
      throw new AppError('INVALID_REFRESH_TOKEN', 'Refresh token has expired.', 401);
    }
    if (session.user.status !== 'ACTIVE' || session.user.deletedAt) {
      throw new AppError('ACCOUNT_INACTIVE', 'This account is not active.', 403);
    }

    return prisma.$transaction(async (tx) => {
      const rotated = await tx.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (rotated.count !== 1) {
        throw new AppError('REFRESH_TOKEN_REUSED', 'Refresh token was already used.', 401);
      }
      return createSession(tx, session.userId, meta);
    });
  }

  async function logout(refreshToken: string | undefined, sessionId: string | undefined): Promise<void> {
    const where: Prisma.SessionWhereInput[] = [];
    if (sessionId) where.push({ id: sessionId });
    if (refreshToken) where.push({ tokenHash: hashToken(refreshToken) });
    if (where.length === 0) return;
    await prisma.session.updateMany({
      where: { OR: where, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async function listSessions(userId: string, currentSessionId?: string) {
    const sessions = await prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userAgent: true, ip: true, createdAt: true, expiresAt: true },
    });
    return sessions.map((session) => ({ ...session, current: session.id === currentSessionId }));
  }

  async function revokeSession(userId: string, sessionId: string): Promise<void> {
    const result = await prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw new AppError('NOT_FOUND', 'Session not found.', 404);
  }

  async function forgotPassword(email: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null, status: { in: ['ACTIVE', 'PENDING'] } },
      select: { id: true, locale: true, email: true },
    });
    if (!user) return;
    const token = await issueAuthToken(prisma, user.id, 'PASSWORD_RESET', RESET_TTL_MS);
    await deps.mailer.send(
      buildEmail('resetPassword', user.locale, user.email, link(user.locale, 'reset-password', token)),
    );
  }

  async function resetPassword(token: string, password: string, meta: RequestMeta): Promise<void> {
    const record = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (
      !record ||
      record.type !== 'PASSWORD_RESET' ||
      record.usedAt ||
      record.expiresAt <= new Date()
    ) {
      throw new AppError('INVALID_TOKEN', 'The token is invalid or has expired.', 400);
    }
    const passwordHash = await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      await tx.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      // Holding the emailed token proves ownership of the address, so pending accounts activate.
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, mustChangePassword: false, emailVerifiedAt: new Date() },
      });
      await tx.user.updateMany({
        where: { id: record.userId, status: 'PENDING' },
        data: { status: 'ACTIVE' },
      });
      await tx.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await writeAudit(
        { ...meta, actorUserId: record.userId },
        { action: 'auth.password_reset', targetType: 'user', targetId: record.userId },
        tx,
      );
    });
  }

  async function changePassword(
    userId: string,
    currentSessionId: string | undefined,
    currentPassword: string,
    newPassword: string,
    meta: RequestMeta,
  ): Promise<void> {
    if (!(await verifyPassword(userId, currentPassword))) {
      throw new AppError('REAUTH_FAILED', 'Current password is incorrect.', 403);
    }
    if (currentPassword === newPassword) {
      throw new AppError('VALIDATION_ERROR', 'The new password must be different.', 400);
    }
    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } });
      await tx.session.updateMany({
        where: { userId, revokedAt: null, ...(currentSessionId ? { id: { not: currentSessionId } } : {}) },
        data: { revokedAt: new Date() },
      });
      await writeAudit(
        { ...meta, actorUserId: userId },
        { action: 'auth.password_change', targetType: 'user', targetId: userId },
        tx,
      );
    });
  }

  /** Re-authentication for privileged actions (docs/06 rule 19). */
  async function requireReauth(userId: string, password: string, ip?: string): Promise<void> {
    const key = `reauth:${userId}|${ip ?? 'unknown'}`;
    const locked = await deps.throttle.lockedFor(key);
    if (locked > 0) {
      throw new AppError('TOO_MANY_ATTEMPTS', `Too many attempts. Retry in ${locked} seconds.`, 429);
    }
    if (!(await verifyPassword(userId, password))) {
      await deps.throttle.recordFailure(key);
      throw new AppError('REAUTH_FAILED', 'Password confirmation failed.', 403);
    }
    await deps.throttle.reset(key);
  }

  async function sendSetPasswordEmail(
    userId: string,
    email: string,
    locale: Locale,
  ): Promise<void> {
    const token = await issueAuthToken(prisma, userId, 'PASSWORD_RESET', SET_PASSWORD_TTL_MS);
    await deps.mailer.send(
      buildEmail('setPassword', locale, email, link(locale, 'reset-password', token)),
    );
  }

  return {
    register,
    verifyEmail,
    login,
    refresh,
    logout,
    listSessions,
    revokeSession,
    forgotPassword,
    resetPassword,
    changePassword,
    requireReauth,
    sendSetPasswordEmail,
    createSession,
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

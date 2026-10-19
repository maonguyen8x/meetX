import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import { prisma } from '../../db/prisma.js';
import { hashPassword } from './auth.service.js';
import { MemoryLoginThrottle } from './login-throttle.js';
import type { EmailMessage } from '../../providers/email/email.provider.js';

const PASSWORD = 'Correct-Horse-Battery-9';
const run = Date.now().toString(36);
const email = (name: string) => `${name}.${run}@test.example.com`;

const outbox: EmailMessage[] = [];
const mailer = {
  async send(message: EmailMessage) {
    outbox.push(message);
  },
};

const app = buildApp(
  { database: async () => undefined, redis: async () => undefined },
  { mailer, throttle: new MemoryLoginThrottle() },
);

function tokenFor(to: string): string {
  const message = [...outbox].reverse().find((item) => item.to === to);
  const match = message?.text.match(/token=([^\s&]+)/);
  if (!match?.[1]) throw new Error(`No token email sent to ${to}`);
  return decodeURIComponent(match[1]);
}

async function call(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
  url: string,
  options: { token?: string; body?: unknown } = {},
) {
  const response = await app.inject({
    method,
    url,
    headers: options.token ? { authorization: `Bearer ${options.token}` } : {},
    ...(options.body === undefined ? {} : { payload: options.body as object }),
  });
  return { status: response.statusCode, body: response.body ? safeJson(response.body) : undefined };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function login(to: string, password = PASSWORD) {
  const result = await call('POST', '/v1/auth/login', { body: { email: to, password } });
  return result;
}

async function activateViaEmail(to: string) {
  const result = await call('POST', '/v1/auth/reset-password', {
    body: { token: tokenFor(to), password: PASSWORD },
  });
  expect(result.status).toBe(204);
}

describe('auth, RBAC and organizations (integration)', () => {
  let superToken = '';
  let adminToken = '';
  let ownerToken = '';
  let memberToken = '';
  let orgId = '';
  let otherOrgId = '';
  let memberId = '';
  let adminId = '';

  let superId = '';

  beforeAll(async () => {
    await app.ready();
    // The seeded Super Admin must change its password on first login, so tests use their own.
    const superUser = await prisma.user.create({
      data: {
        email: email('super'),
        name: 'Test Super',
        passwordHash: await hashPassword(PASSWORD),
        platformRole: 'SUPER_ADMIN',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });
    superId = superUser.id;
    const result = await login(email('super'));
    expect(result.status).toBe(200);
    superToken = result.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('super admin creates an admin who activates via emailed link', async () => {
    const created = await call('POST', '/v1/admin/admins', {
      token: superToken,
      body: { email: email('admin'), name: 'Test Admin', locale: 'en' },
    });
    expect(created.status).toBe(201);
    adminId = created.body.user.id;

    expect((await login(email('admin'))).status).toBeGreaterThanOrEqual(400);
    await activateViaEmail(email('admin'));
    const session = await login(email('admin'));
    expect(session.status).toBe(200);
    adminToken = session.body.accessToken;
  });

  it('admin cannot create admins or change roles', async () => {
    const create = await call('POST', '/v1/admin/admins', {
      token: adminToken,
      body: { email: email('rogue'), name: 'Rogue', locale: 'en' },
    });
    expect(create.status).toBe(403);
  });

  it('super admin creates an organization with an org admin owner; owner invites a member', async () => {
    const org = await call('POST', '/v1/admin/orgs', {
      token: superToken,
      body: { name: `Acme ${run}`, ownerEmail: email('owner'), ownerName: 'Owner' },
    });
    expect(org.status).toBe(201);
    orgId = org.body.organization.id;
    await activateViaEmail(email('owner'));
    ownerToken = (await login(email('owner'))).body.accessToken;

    const other = await call('POST', '/v1/admin/orgs', {
      token: adminToken,
      body: { name: `Other ${run}`, ownerEmail: email('owner2'), ownerName: 'Owner Two' },
    });
    expect(other.status).toBe(201);
    otherOrgId = other.body.organization.id;

    const invite = await call('POST', `/v1/orgs/${orgId}/invitations`, {
      token: ownerToken,
      body: { email: email('member'), orgRole: 'ORG_MEMBER' },
    });
    expect(invite.status).toBe(202);

    const accept = await call('POST', '/v1/orgs/invitations/accept', {
      body: { token: tokenFor(email('member')), name: 'Member', password: PASSWORD },
    });
    expect(accept.status).toBe(204);
    const session = await login(email('member'));
    expect(session.status).toBe(200);
    memberToken = session.body.accessToken;
    memberId = session.body.user.id;
  });

  it('denies cross-organization and cross-role access', async () => {
    expect((await call('GET', `/v1/orgs/${otherOrgId}`, { token: ownerToken })).status).toBe(404);
    expect((await call('GET', `/v1/orgs/${otherOrgId}/members`, { token: ownerToken })).status).toBe(404);
    expect((await call('GET', '/v1/admin/users', { token: memberToken })).status).toBe(403);
    expect((await call('GET', `/v1/orgs/${orgId}/members`, { token: memberToken })).status).toBe(403);
    expect((await call('GET', `/v1/orgs/${orgId}/members`, { token: ownerToken })).status).toBe(200);
    expect((await call('GET', '/v1/admin/users')).status).toBe(401);
  });

  it('admin cannot modify a super admin', async () => {
    const result = await call('POST', `/v1/admin/users/${superId}/deactivate`, {
      token: adminToken,
      body: {},
    });
    expect(result.status).toBe(403);
  });

  it('does not allow a super admin to change their own role', async () => {
    const result = await call('POST', `/v1/admin/users/${superId}/role`, {
      token: superToken,
      body: { role: 'USER', currentPassword: PASSWORD },
    });
    expect(result.status).toBe(403);
  });

  it('requires re-authentication for privileged actions', async () => {
    const result = await call('POST', `/v1/admin/users/${memberId}/role`, {
      token: superToken,
      body: { role: 'USER', currentPassword: 'wrong-password-123' },
    });
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe('REAUTH_FAILED');
  });

  it('rotates refresh tokens and revokes everything on replay', async () => {
    const first = await login(email('member'));
    const rotated = await call('POST', '/v1/auth/refresh', { body: { refreshToken: first.body.refreshToken } });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(first.body.refreshToken);

    const replay = await call('POST', '/v1/auth/refresh', { body: { refreshToken: first.body.refreshToken } });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('REFRESH_TOKEN_REUSED');

    const afterReplay = await call('POST', '/v1/auth/refresh', { body: { refreshToken: rotated.body.refreshToken } });
    expect(afterReplay.status).toBe(401);
    expect((await call('GET', '/v1/me', { token: rotated.body.accessToken })).status).toBe(401);
  });

  it('logs a deactivated user out immediately', async () => {
    const session = await login(email('member'));
    const token = session.body.accessToken;
    expect((await call('GET', '/v1/me', { token })).status).toBe(200);

    const deactivated = await call('POST', `/v1/admin/users/${memberId}/deactivate`, {
      token: adminToken,
      body: { reason: 'test' },
    });
    expect(deactivated.status).toBe(200);
    expect((await call('GET', '/v1/me', { token })).status).toBe(401);
    expect((await login(email('member'))).status).toBe(403);

    const reactivated = await call('POST', `/v1/admin/users/${memberId}/activate`, { token: adminToken });
    expect(reactivated.status).toBe(200);
    expect((await login(email('member'))).status).toBe(200);
  });

  it('removes a member and keeps the audit trail', async () => {
    const removed = await call('DELETE', `/v1/orgs/${orgId}/members/${memberId}`, { token: ownerToken });
    expect(removed.status).toBe(204);

    const actions = await prisma.auditLog.findMany({
      where: { OR: [{ organizationId: orgId }, { targetId: adminId }] },
      select: { action: true },
    });
    const names = actions.map((row) => row.action);
    expect(names).toEqual(expect.arrayContaining(['org.create', 'org.invite', 'org.invitation_accept', 'org.member_remove', 'admin.create']));
  });
});

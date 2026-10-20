import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';

import { buildApp } from '../app.js';
import { prisma } from '../db/prisma.js';
import { hashPassword } from './auth/auth.service.js';
import { MemoryLoginThrottle } from './auth/login-throttle.js';
import { provisionUserDefaults } from './users/provisioning.js';
import type { AvatarStorage } from './settings/avatar-storage.js';
import { encryptSensitiveText } from '../utils/crypto.js';

const PASSWORD = 'Correct-Horse-Battery-9';
const ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
const run = Date.now().toString(36);
const users: Array<{ id: string; email: string; token: string }> = [];
const avatarFiles = new Map<string, Buffer>();
const avatarFilename = 'b'.repeat(48) + '.webp';
const avatarStorage: AvatarStorage = {
  async save(image) {
    avatarFiles.set(avatarFilename, image);
    return avatarFilename;
  },
  async read(filename) {
    return avatarFiles.get(filename) ?? null;
  },
  async remove(filename) {
    avatarFiles.delete(filename);
  },
};
const app = buildApp(
  { database: async () => undefined, redis: async () => undefined },
  {
    dataEncryptionKey: ENCRYPTION_KEY,
    avatarStorage,
    throttle: new MemoryLoginThrottle(),
  },
);

async function createUser(label: string) {
  const email = `${label}.${run}@test.example.com`;
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name: label,
        passwordHash: await hashPassword(PASSWORD),
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
      select: { id: true, email: true },
    });
    await provisionUserDefaults(tx, created.id, created.email);
    return created;
  });
  const login = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password: PASSWORD },
  });
  expect(login.statusCode).toBe(200);
  const token = login.json<{ accessToken: string }>().accessToken;
  const created = { ...user, token };
  users.push(created);
  return created;
}

function authorized(token: string) {
  return { authorization: `Bearer ${token}` };
}

describe('backend core routes (integration)', () => {
  let owner: (typeof users)[number];
  let other: (typeof users)[number];
  let meetingId = '';
  let glossaryId = '';

  beforeAll(async () => {
    await app.ready();
    owner = await createUser('core-owner');
    other = await createUser('core-other');
    const meeting = await prisma.meeting.create({
      data: {
        ownerId: owner.id,
        type: 'ROOM',
        platform: 'INTERNAL',
        title: 'Encrypted demo meeting',
        sourceLang: 'en',
        targetLang: 'vi',
        status: 'ENDED',
        startedAt: new Date('2026-10-20T01:00:00.000Z'),
        endedAt: new Date('2026-10-20T01:05:00.000Z'),
        durationSec: 300,
      },
      select: { id: true },
    });
    meetingId = meeting.id;
    await prisma.turn.create({
      data: {
        meetingId,
        lang: 'en',
        originalTextEnc: encryptSensitiveText('The transcript is private.', ENCRYPTION_KEY),
        translatedTextEnc: encryptSensitiveText('Bản ghi này là riêng tư.', ENCRYPTION_KEY),
        startedMs: 0,
        endedMs: 1_000,
      },
    });
    await prisma.meetingSummary.create({
      data: {
        meetingId,
        summaryMdEnc: encryptSensitiveText('Private summary.', ENCRYPTION_KEY),
        actionItems: ['Follow up'],
        decisions: ['Continue'],
      },
    });
    await prisma.meeting.create({
      data: {
        ownerId: other.id,
        type: 'ROOM',
        platform: 'INTERNAL',
        sourceLang: 'ja',
        targetLang: 'en',
        status: 'ENDED',
      },
    });
  });

  afterAll(async () => {
    await app.close();
    if (users.length) {
      const ids = users.map((user) => user.id);
      await prisma.meeting.deleteMany({ where: { ownerId: { in: ids } } });
      await prisma.glossaryTerm.deleteMany({ where: { ownerUserId: { in: ids } } });
      const accounts = await prisma.billingAccount.findMany({
        where: { ownerType: 'USER', ownerId: { in: ids } },
        select: { id: true },
      });
      await prisma.wallet.deleteMany({
        where: { billingAccountId: { in: accounts.map((account) => account.id) } },
      });
      await prisma.billingAccount.deleteMany({ where: { id: { in: accounts.map((account) => account.id) } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
  });

  it('validates settings, processes avatars, and exposes an explicit voice-preview stub', async () => {
    const docs = await app.inject({
      method: 'GET',
      url: '/docs',
      headers: authorized(owner.token),
    });
    expect(docs.statusCode).toBe(200);

    const loaded = await app.inject({
      method: 'GET',
      url: '/v1/settings',
      headers: authorized(owner.token),
    });
    expect(loaded.statusCode).toBe(200);

    const changed = await app.inject({
      method: 'PATCH',
      url: '/v1/settings',
      headers: authorized(owner.token),
      payload: { defaultPair: { sourceLang: 'ja', targetLang: 'vi' }, speed: 1.1 },
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json<{ defaultPair: { sourceLang: string } }>().defaultPair.sourceLang).toBe('ja');

    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#0f766e' },
    })
      .png()
      .toBuffer();
    const boundary = 'meetx-phase-three-boundary';
    const multipart = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="profile.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const upload = await app.inject({
      method: 'POST',
      url: '/v1/settings/avatar',
      headers: {
        ...authorized(owner.token),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipart,
    });
    expect(upload.statusCode).toBe(200);
    const avatarUrl = upload.json<{ avatarUrl: string }>().avatarUrl;
    expect(avatarUrl).toBe(`/v1/settings/avatar/${avatarFilename}`);

    const preview = await app.inject({
      method: 'POST',
      url: '/v1/settings/voice-preview',
      headers: authorized(owner.token),
      payload: { lang: 'ja' },
    });
    expect(preview.statusCode).toBe(503);
    expect(preview.json<{ error: { code: string } }>().error.code).toBe('VOICE_PREVIEW_UNAVAILABLE');
  });

  it('supports scoped glossary CRUD and refuses another user’s term', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/glossary',
      headers: authorized(owner.token),
      payload: {
        sourceLang: 'en',
        targetLang: 'ja',
        sourceTerm: 'quarterly review',
        targetTerm: '四半期レビュー',
      },
    });
    expect(created.statusCode).toBe(201);
    glossaryId = created.json<{ id: string }>().id;

    const hidden = await app.inject({
      method: 'PATCH',
      url: `/v1/glossary/${glossaryId}`,
      headers: authorized(other.token),
      payload: { targetTerm: 'not yours' },
    });
    expect(hidden.statusCode).toBe(404);

    const updated = await app.inject({
      method: 'PATCH',
      url: `/v1/glossary/${glossaryId}`,
      headers: authorized(owner.token),
      payload: { targetTerm: '四半期のレビュー' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json<{ targetTerm: string }>().targetTerm).toBe('四半期のレビュー');
  });

  it('decrypts, exports, tenant-scopes, and deletes meeting history and transcript data', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/v1/meetings',
      headers: authorized(owner.token),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json<{ items: Array<{ id: string }> }>().items.map((item) => item.id)).toContain(
      meetingId,
    );

    const inaccessible = await app.inject({
      method: 'GET',
      url: `/v1/meetings/${meetingId}`,
      headers: authorized(other.token),
    });
    expect(inaccessible.statusCode).toBe(404);

    const details = await app.inject({
      method: 'GET',
      url: `/v1/meetings/${meetingId}`,
      headers: authorized(owner.token),
    });
    expect(details.statusCode).toBe(200);
    expect(details.json<{ turns: Array<{ originalText: string }>; summary: { summary: string } }>().turns[0]?.originalText)
      .toBe('The transcript is private.');
    expect(details.json<{ summary: { summary: string } }>().summary.summary).toBe('Private summary.');

    const exported = await app.inject({
      method: 'GET',
      url: `/v1/meetings/${meetingId}/export?format=md`,
      headers: authorized(owner.token),
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.body).toContain('The transcript is private.');

    const removed = await app.inject({
      method: 'DELETE',
      url: `/v1/meetings/${meetingId}`,
      headers: authorized(owner.token),
    });
    expect(removed.statusCode).toBe(204);
    expect(await prisma.turn.count({ where: { meetingId } })).toBe(0);
    expect(await prisma.meetingSummary.count({ where: { meetingId } })).toBe(0);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { buildApp } from '../app.js';
import { prisma } from '../db/prisma.js';
import { hashPassword } from '../modules/auth/auth.service.js';
import { MemoryLoginThrottle } from '../modules/auth/login-throttle.js';
import { provisionUserDefaults } from '../modules/users/provisioning.js';
import { silenceFrames, speechFrames } from '../../test/fakes/audio.js';
import { FakeSttProvider } from '../../test/fakes/fake-stt.js';
import { FakeTranslateProvider } from '../../test/fakes/fake-translate.js';
import { FakeTtsProvider } from '../../test/fakes/fake-tts.js';
import { StubUsageHooks } from './usage-hooks.js';

const PASSWORD = 'Correct-Horse-Battery-9';
const run = Date.now().toString(36);
const users: Array<{ id: string; token: string }> = [];

const usage = new StubUsageHooks();
const app = buildApp(
  { database: async () => undefined, redis: async () => undefined },
  {
    throttle: new MemoryLoginThrottle(),
    usageHooks: usage,
    realtimeProviders: {
      stt: new FakeSttProvider({ script: ['Xin chào', 'Cảm ơn', 'Tạm biệt'], lang: 'vi' }),
      translate: new FakeTranslateProvider({
        translations: { 'Xin chào': '[warm] こんにちは。', 'Cảm ơn': 'ありがとうございます。' },
      }),
      tts: new FakeTtsProvider(),
    },
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
  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: PASSWORD } });
  expect(login.statusCode).toBe(200);
  const entry = { id: user.id, token: login.json<{ accessToken: string }>().accessToken };
  users.push(entry);
  return entry;
}

type Json = Record<string, unknown> & { type: string };

class Client {
  readonly messages: Json[] = [];
  binaryFrames = 0;
  private constructor(readonly ws: WebSocket) {
    ws.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
      if (isBinary) this.binaryFrames += 1;
      else this.messages.push(JSON.parse(data.toString()) as Json);
    });
  }

  static async connect(url: string): Promise<Client> {
    const ws = new WebSocket(url);
    const client = new Client(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    return client;
  }

  send(message: object): void {
    this.ws.send(JSON.stringify(message));
  }

  frames(frames: Uint8Array[]): void {
    for (const frame of frames) this.ws.send(frame, { binary: true });
  }

  async waitFor(type: string, timeoutMs = 5000): Promise<Json> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = this.messages.find((m) => m.type === type);
      if (found) return found;
      if (Date.now() > deadline) throw new Error(`Timed out waiting for ${type}; got ${this.messages.map((m) => m.type).join(',')}`);
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  async closed(): Promise<number> {
    if (this.ws.readyState === WebSocket.CLOSED) return 0;
    return new Promise((resolve) => this.ws.once('close', (code) => resolve(code)));
  }
}

describe('realtime WebSocket gateway (integration)', () => {
  let alice: (typeof users)[number];
  let bob: (typeof users)[number];
  let baseUrl = '';

  const url = (token: string, extra = '') => `${baseUrl}/v1/ws/session?token=${encodeURIComponent(token)}${extra}`;

  beforeAll(async () => {
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('no address');
    baseUrl = `ws://127.0.0.1:${address.port}`;
    alice = await createUser('rt-alice');
    bob = await createUser('rt-bob');
  });

  afterAll(async () => {
    await app.close();
    const ids = users.map((u) => u.id);
    if (ids.length === 0) return;
    await prisma.meeting.deleteMany({ where: { ownerId: { in: ids } } });
    const accounts = await prisma.billingAccount.findMany({
      where: { ownerType: 'USER', ownerId: { in: ids } },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);
    await prisma.wallet.deleteMany({ where: { billingAccountId: { in: accountIds } } });
    await prisma.billingAccount.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it('rejects connections without a valid token', async () => {
    const status = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`${baseUrl}/v1/ws/session`);
      ws.once('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0));
      ws.once('error', () => undefined);
    });
    expect(status).toBe(401);

    const badStatus = await new Promise<number>((resolve) => {
      const ws = new WebSocket(url('not-a-jwt'));
      ws.once('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0));
      ws.once('error', () => undefined);
    });
    expect(badStatus).toBe(401);
  });

  it('runs a full interpreted turn in protocol order', async () => {
    const client = await Client.connect(url(alice.token));
    client.send({ type: 'session.start', sourceLang: 'vi', targetLang: 'ja', mode: 'translate' });
    const ready = await client.waitFor('session.ready');
    expect(ready).toMatchObject({ resumed: false });

    client.frames(speechFrames(1000));
    client.frames(silenceFrames(900));
    await client.waitFor('usage.tick');

    const sequence = client.messages.map((m) => m.type).filter((t, i, all) => t !== 'caption.partial' || all[i - 1] !== t);
    expect(sequence).toEqual([
      'session.ready',
      'turn.start',
      'caption.partial',
      'caption.final',
      'translation.text',
      'translation.audio.start',
      'translation.audio.end',
      'usage.tick',
    ]);
    expect(client.binaryFrames).toBeGreaterThan(0);
    expect(client.messages.find((m) => m.type === 'translation.text')).toMatchObject({
      text: 'こんにちは。',
      lang: 'ja',
      emotion: 'warm',
    });
    expect(client.messages.find((m) => m.type === 'translation.audio.start')).toMatchObject({
      format: 'pcm16',
      sampleRate: 24000,
    });
    expect(usage.records.some((r) => r.userId === alice.id && r.ttsCharacters > 0)).toBe(true);

    client.send({ type: 'session.end' });
    expect(await client.closed()).toBe(1000);
  });

  it('validates messages and requires session.start before audio', async () => {
    const client = await Client.connect(url(alice.token));
    client.send({ type: 'translate.now' });
    expect(await client.waitFor('error')).toMatchObject({ code: 'NOT_STARTED' });
    client.messages.length = 0;
    client.ws.send('{not json');
    expect(await client.waitFor('error')).toMatchObject({ code: 'INVALID_MESSAGE' });
    client.messages.length = 0;
    client.send({ type: 'session.start', sourceLang: 'vi', targetLang: 'vi' });
    expect(await client.waitFor('error')).toMatchObject({ code: 'INVALID_MESSAGE' });
    client.ws.close();
  });

  it('rejects another user’s meeting', async () => {
    const meeting = await prisma.meeting.create({
      data: { ownerId: bob.id, type: 'ROOM', platform: 'INTERNAL', sourceLang: 'vi', targetLang: 'ja', status: 'ENDED' },
      select: { id: true },
    });
    const client = await Client.connect(url(alice.token));
    client.send({ type: 'session.start', sourceLang: 'vi', targetLang: 'ja', meetingId: meeting.id });
    expect(await client.waitFor('error')).toMatchObject({ code: 'NOT_FOUND' });
    await client.closed();
  });

  it('lets the owner resume a dropped session but nobody else', async () => {
    const first = await Client.connect(url(alice.token));
    first.send({ type: 'session.start', sourceLang: 'vi', targetLang: 'ja' });
    const ready = await first.waitFor('session.ready');
    const sessionId = String(ready.sessionId);
    first.ws.close();
    await first.closed();

    const thief = await Client.connect(url(bob.token, `&resume=${sessionId}`));
    expect(await thief.waitFor('error')).toMatchObject({ code: 'SESSION_NOT_FOUND' });
    await thief.closed();

    const resumed = await Client.connect(url(alice.token, `&resume=${sessionId}`));
    expect(await resumed.waitFor('session.ready')).toMatchObject({ sessionId, resumed: true });
    resumed.send({ type: 'session.end' });
    await resumed.closed();
  });

  it('rejects malformed audio frames', async () => {
    const client = await Client.connect(url(alice.token));
    client.send({ type: 'session.start', sourceLang: 'vi', targetLang: 'ja' });
    await client.waitFor('session.ready');
    client.ws.send(new Uint8Array(3), { binary: true });
    expect(await client.waitFor('error')).toMatchObject({ code: 'INVALID_FRAME' });
    client.send({ type: 'session.end' });
    await client.closed();
  });
});

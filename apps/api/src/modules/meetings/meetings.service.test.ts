import type { Prisma } from '@prisma/client';
import { buildActor } from '../../authorization/policy.js';
import type { Actor } from '../../authorization/policy.js';
import { describe, expect, it, vi } from 'vitest';

import { decryptSensitiveText, encryptSensitiveText } from '../../utils/crypto.js';
import type { MeetingDetailRecord, MeetingsRepository } from './meetings.repository.js';
import { createMeetingsService } from './meetings.service.js';

const KEY = Buffer.alloc(32, 4).toString('base64');
const MEETING_ID = '30a9fda1-87cf-4b59-9837-3b36512a38e0';

const meeting: MeetingDetailRecord = {
  id: MEETING_ID,
  ownerId: '23588b08-ad5e-49a8-b1de-06d773971b03',
  organizationId: null,
  type: 'ROOM',
  title: 'Quarterly review',
  platform: 'INTERNAL',
  meetingUrl: null,
  sourceLang: 'en',
  targetLang: 'ja',
  status: 'ENDED',
  startedAt: new Date('2026-10-20T01:00:00.000Z'),
  endedAt: new Date('2026-10-20T01:05:00.000Z'),
  durationSec: 300,
  customerTag: null,
  createdAt: new Date('2026-10-20T01:00:00.000Z'),
  updatedAt: new Date('2026-10-20T01:05:00.000Z'),
  deletedAt: null,
  turns: [
    {
      id: '66e518a0-5b64-4fa0-8832-2d8c7ca8f17a',
      meetingId: MEETING_ID,
      participantId: null,
      speakerLabel: 'A',
      lang: 'en',
      originalTextEnc: encryptSensitiveText('Hello there.', KEY),
      translatedTextEnc: encryptSensitiveText('こんにちは。', KEY),
      emotion: null,
      startedMs: 0,
      endedMs: 1_000,
      sttConfidence: 0.99,
      createdAt: new Date('2026-10-20T01:00:01.000Z'),
    },
  ],
  summary: null,
};

function createActor(userId: string): Actor {
  return buildActor({
    id: userId,
    email: 'owner@example.com',
    platformRole: 'USER',
    status: 'ACTIVE',
    rolePermissions: { USER: ['interpreter.use'] },
    memberships: [],
    overrides: [],
  });
}

describe('meetings service', () => {
  it('decrypts transcript details and exports Markdown without exposing encrypted fields', async () => {
    const repository = {
      list: vi.fn<MeetingsRepository['list']>().mockResolvedValue({ items: [], total: 0 }),
      findById: vi.fn<MeetingsRepository['findById']>().mockResolvedValue(meeting),
      softDelete: vi.fn<MeetingsRepository['softDelete']>().mockResolvedValue(true),
      findSaveHistory: vi.fn<MeetingsRepository['findSaveHistory']>().mockResolvedValue(true),
      saveSummary: vi.fn<MeetingsRepository['saveSummary']>().mockResolvedValue(undefined),
    } satisfies MeetingsRepository;
    const service = createMeetingsService(repository, KEY);
    const actor = createActor(meeting.ownerId);

    const details = await service.get(actor, MEETING_ID);
    const exported = await service.exportMeeting(actor, MEETING_ID, 'md');

    expect(details.turns[0]?.originalText).toBe('Hello there.');
    expect(details.turns[0]).not.toHaveProperty('originalTextEnc');
    expect(exported.body).toContain('> こんにちは。');
    expect(exported.filename).toBe(`meeting-${MEETING_ID}.md`);
  });

  it('encrypts stored summaries and scopes organization queries to active memberships', async () => {
    const organizationId = '2d7b506d-a029-48fd-a6c0-cba2d9ed5909';
    const actor = buildActor({
      id: meeting.ownerId,
      email: 'owner@example.com',
      platformRole: 'USER',
      status: 'ACTIVE',
      rolePermissions: { USER: ['interpreter.use'], ORG_MEMBER: ['interpreter.use'] },
      memberships: [
        {
          organizationId,
          orgRole: 'ORG_MEMBER',
          isOwner: false,
          membershipActive: true,
          organizationActive: true,
        },
      ],
      overrides: [],
    });
    const repository = {
      list: vi.fn<MeetingsRepository['list']>().mockResolvedValue({ items: [], total: 0 }),
      findById: vi.fn<MeetingsRepository['findById']>().mockResolvedValue(meeting),
      softDelete: vi.fn<MeetingsRepository['softDelete']>().mockResolvedValue(true),
      findSaveHistory: vi.fn<MeetingsRepository['findSaveHistory']>().mockResolvedValue(true),
      saveSummary: vi.fn<MeetingsRepository['saveSummary']>().mockResolvedValue(undefined),
    } satisfies MeetingsRepository;
    const service = createMeetingsService(repository, KEY);

    await service.saveSummary(actor, MEETING_ID, {
      summary: 'Sensitive summary',
      actionItems: ['Follow up'],
      decisions: ['Proceed'],
    });
    await service.list(actor, { page: 1, limit: 10 });

    const savedSummary = repository.saveSummary.mock.calls[0]?.[1];
    expect(savedSummary?.summaryMdEnc).not.toContain('Sensitive summary');
    expect(decryptSensitiveText(savedSummary?.summaryMdEnc ?? '', KEY)).toBe('Sensitive summary');
    const query = repository.list.mock.calls[0]?.[0] as Prisma.MeetingWhereInput;
    expect(query.OR).toContainEqual({ organizationId: { in: [organizationId] } });
    expect(query.OR).toContainEqual({ ownerId: actor.id, organizationId: null });
  });

  it('refuses to persist summaries when meeting history is disabled', async () => {
    const repository = {
      list: vi.fn<MeetingsRepository['list']>().mockResolvedValue({ items: [], total: 0 }),
      findById: vi.fn<MeetingsRepository['findById']>().mockResolvedValue(meeting),
      softDelete: vi.fn<MeetingsRepository['softDelete']>().mockResolvedValue(true),
      findSaveHistory: vi.fn<MeetingsRepository['findSaveHistory']>().mockResolvedValue(false),
      saveSummary: vi.fn<MeetingsRepository['saveSummary']>().mockResolvedValue(undefined),
    } satisfies MeetingsRepository;

    await expect(
      createMeetingsService(repository, KEY).saveSummary(createActor(meeting.ownerId), MEETING_ID, {
        summary: 'Do not persist this.',
        actionItems: [],
        decisions: [],
      }),
    ).rejects.toThrow('Meeting history is disabled for this account.');
    expect(repository.saveSummary).not.toHaveBeenCalled();
  });
});

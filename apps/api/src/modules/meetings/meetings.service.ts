import type { Actor } from '../../authorization/policy.js';
import { can } from '../../authorization/policy.js';
import type {
  exportMeetingQuerySchema,
  listMeetingsQuerySchema,
  meetingSummarySchema,
} from '@meetx/shared/schemas/meeting';
import {
  meetingDetailResponseSchema,
  meetingExportResponseSchema,
  meetingListResponseSchema,
} from '@meetx/shared/schemas/meeting';
import type { z } from 'zod';

import { forbidden, notFound } from '../../utils/app-errors.js';
import { decryptSensitiveText, encryptSensitiveText } from '../../utils/crypto.js';
import { AppError } from '../../utils/errors.js';
import type { MeetingDetailRecord, MeetingsRepository } from './meetings.repository.js';

type ListQuery = z.infer<typeof listMeetingsQuerySchema>;
type ExportFormat = z.infer<typeof exportMeetingQuerySchema>['format'];
type SummaryInput = z.infer<typeof meetingSummarySchema>;

export function createMeetingsService(repository: MeetingsRepository, encryptionKey?: string) {
  async function list(actor: Actor, query: ListQuery) {
    if (!hasAnyMeetingAccess(actor)) throw forbidden();
    const where = meetingScope(actor, query.organizationId);
    const { items, total } = await repository.list(where, (query.page - 1) * query.limit, query.limit);
    return meetingListResponseSchema.parse({
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    });
  }

  async function get(actor: Actor, id: string) {
    const meeting = await repository.findById({ ...meetingScope(actor), id });
    if (!meeting) throw notFound('Meeting not found.');
    return presentMeeting(meeting, encryptionKey);
  }

  async function remove(actor: Actor, id: string): Promise<void> {
    const deleted = await repository.softDelete({ ...meetingScope(actor), id });
    if (!deleted) throw notFound('Meeting not found.');
  }

  async function exportMeeting(actor: Actor, id: string, format: ExportFormat) {
    const meeting = await get(actor, id);
    const body = format === 'json' ? JSON.stringify(meeting, null, 2) : toMarkdown(meeting);
    return meetingExportResponseSchema.parse({
      body,
      contentType: format === 'json' ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8',
      filename: `meeting-${id}.${format}`,
    });
  }

  async function saveSummary(actor: Actor, meetingId: string, input: SummaryInput): Promise<void> {
    const meeting = await repository.findById({ ...meetingScope(actor), id: meetingId });
    if (!meeting) throw notFound('Meeting not found.');
    const saveHistory = await repository.findSaveHistory(meeting.ownerId);
    if (saveHistory === null) throw notFound('Interpreter settings not found.');
    if (!saveHistory) {
      throw new AppError('MEETING_HISTORY_DISABLED', 'Meeting history is disabled for this account.', 409);
    }
    await repository.saveSummary(meetingId, {
      summaryMdEnc: encryptSensitiveText(input.summary, encryptionKey),
      actionItems: input.actionItems,
      decisions: input.decisions,
    });
  }

  return { list, get, remove, exportMeeting, saveSummary };
}

function meetingScope(actor: Actor, organizationId?: string) {
  if (organizationId) {
    requireOrganizationAccess(actor, organizationId);
    return { organizationId, deletedAt: null };
  }
  const personalAccess = can(actor, 'interpreter.use');
  const organizationIds = actor.memberships
    .filter((membership) =>
      can(actor, 'interpreter.use', { organizationId: membership.organizationId }),
    )
    .map((membership) => membership.organizationId);
  return {
    deletedAt: null,
    OR: [
      ...(personalAccess ? [{ ownerId: actor.id, organizationId: null }] : []),
      ...(organizationIds.length ? [{ organizationId: { in: organizationIds } }] : []),
    ],
  };
}

function hasAnyMeetingAccess(actor: Actor): boolean {
  return (
    can(actor, 'interpreter.use') ||
    actor.memberships.some((membership) =>
      can(actor, 'interpreter.use', { organizationId: membership.organizationId }),
    )
  );
}

function requireOrganizationAccess(actor: Actor, organizationId: string): void {
  const membership = actor.memberships.some((item) => item.organizationId === organizationId);
  if (!membership || !can(actor, 'interpreter.use', { organizationId })) {
    throw notFound('Meeting not found.');
  }
}

function presentMeeting(
  meeting: MeetingDetailRecord,
  encryptionKey?: string,
) {
  return meetingDetailResponseSchema.parse({
    id: meeting.id,
    organizationId: meeting.organizationId,
    type: meeting.type,
    title: meeting.title,
    platform: meeting.platform,
    sourceLang: meeting.sourceLang,
    targetLang: meeting.targetLang,
    status: meeting.status,
    startedAt: meeting.startedAt,
    endedAt: meeting.endedAt,
    durationSec: meeting.durationSec,
    createdAt: meeting.createdAt,
    turns: meeting.turns.map((turn) => ({
      id: turn.id,
      participantId: turn.participantId,
      speakerLabel: turn.speakerLabel,
      lang: turn.lang,
      originalText: decryptSensitiveText(turn.originalTextEnc, encryptionKey),
      translatedText: decryptSensitiveText(turn.translatedTextEnc, encryptionKey),
      emotion: turn.emotion,
      startedMs: turn.startedMs,
      endedMs: turn.endedMs,
      sttConfidence: turn.sttConfidence,
    })),
    summary: meeting.summary
      ? {
          summary: decryptSensitiveText(meeting.summary.summaryMdEnc, encryptionKey),
          actionItems: parseStringList(meeting.summary.actionItems),
          decisions: parseStringList(meeting.summary.decisions),
          generatedAt: meeting.summary.generatedAt,
        }
      : null,
  });
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error('Stored meeting summary list is invalid.');
  }
  return value;
}

function toMarkdown(meeting: ReturnType<typeof presentMeeting>): string {
  const lines = [
    `# ${meeting.title ?? 'Meeting'}`,
    '',
    `- Status: ${meeting.status}`,
    `- Language pair: ${meeting.sourceLang} → ${meeting.targetLang}`,
    `- Started: ${meeting.startedAt?.toISOString() ?? 'Not started'}`,
    '',
    '## Transcript',
    '',
  ];
  for (const turn of meeting.turns) {
    lines.push(`### ${turn.speakerLabel ?? 'Speaker'} (${turn.lang})`);
    lines.push(turn.originalText, '', `> ${turn.translatedText}`, '');
  }
  if (meeting.summary) {
    lines.push('## Summary', '', meeting.summary.summary, '', '## Action items', '');
    lines.push(...meeting.summary.actionItems.map((item) => `- ${item}`), '');
    lines.push('## Decisions', '', ...meeting.summary.decisions.map((item) => `- ${item}`), '');
  }
  return `${lines.join('\n')}\n`;
}

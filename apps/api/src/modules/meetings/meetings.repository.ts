import type { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '../../db/prisma.js';

export type MeetingListRecord = Prisma.MeetingGetPayload<{
  select: {
    id: true;
    organizationId: true;
    type: true;
    title: true;
    platform: true;
    sourceLang: true;
    targetLang: true;
    status: true;
    startedAt: true;
    endedAt: true;
    durationSec: true;
    createdAt: true;
  };
}>;
export type MeetingDetailRecord = Prisma.MeetingGetPayload<{
  include: { turns: true; summary: true };
}>;
export type MeetingSummaryData = {
  summaryMdEnc: string;
  actionItems: Prisma.InputJsonValue;
  decisions: Prisma.InputJsonValue;
};

export interface MeetingsRepository {
  list(where: Prisma.MeetingWhereInput, skip: number, take: number): Promise<{
    items: MeetingListRecord[];
    total: number;
  }>;
  findById(where: Prisma.MeetingWhereInput): Promise<MeetingDetailRecord | null>;
  softDelete(where: Prisma.MeetingWhereInput): Promise<boolean>;
  findSaveHistory(userId: string): Promise<boolean | null>;
  saveSummary(meetingId: string, data: MeetingSummaryData): Promise<void>;
}

export function createMeetingsRepository(client: PrismaClient = prisma): MeetingsRepository {
  return {
    async list(where, skip, take) {
      const [items, total] = await Promise.all([
        client.meeting.findMany({
          where,
          select: {
            id: true,
            organizationId: true,
            type: true,
            title: true,
            platform: true,
            sourceLang: true,
            targetLang: true,
            status: true,
            startedAt: true,
            endedAt: true,
            durationSec: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        client.meeting.count({ where }),
      ]);
      return { items, total };
    },
    findById: (where) =>
      client.meeting.findFirst({
        where,
        include: { turns: { orderBy: { startedMs: 'asc' } }, summary: true },
      }),
    async softDelete(where) {
      return client.$transaction(async (tx) => {
        const meeting = await tx.meeting.findFirst({ where, select: { id: true } });
        if (!meeting) return false;
        const result = await tx.meeting.updateMany({
          where: { ...where, id: meeting.id },
          data: { deletedAt: new Date() },
        });
        if (result.count === 0) return false;
        await Promise.all([
          tx.turn.deleteMany({ where: { meetingId: meeting.id } }),
          tx.meetingParticipant.deleteMany({ where: { meetingId: meeting.id } }),
          tx.meetingSummary.deleteMany({ where: { meetingId: meeting.id } }),
          tx.bot.deleteMany({ where: { meetingId: meeting.id } }),
        ]);
        return true;
      });
    },
    async findSaveHistory(userId) {
      const settings = await client.interpreterSettings.findUnique({
        where: { userId },
        select: { saveHistory: true },
      });
      return settings?.saveHistory ?? null;
    },
    async saveSummary(meetingId, data) {
      await client.meetingSummary.upsert({
        where: { meetingId },
        create: { meetingId, ...data },
        update: data,
      });
    },
  };
}

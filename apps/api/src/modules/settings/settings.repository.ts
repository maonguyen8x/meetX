import type { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '../../db/prisma.js';

export type SettingsRecord = Prisma.InterpreterSettingsGetPayload<Record<string, never>>;

export interface SettingsRepository {
  findByUserId(userId: string): Promise<SettingsRecord | null>;
  update(userId: string, data: Prisma.InterpreterSettingsUpdateInput): Promise<SettingsRecord>;
}

export function createSettingsRepository(
  client: Pick<PrismaClient, 'interpreterSettings'> = prisma,
): SettingsRepository {
  return {
    findByUserId: (userId) =>
      client.interpreterSettings.findUnique({ where: { userId } }),
    update: (userId, data) =>
      client.interpreterSettings.update({ where: { userId }, data }),
  };
}

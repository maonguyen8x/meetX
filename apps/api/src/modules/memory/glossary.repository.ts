import type { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '../../db/prisma.js';

export interface GlossaryRepository {
  list(where: Prisma.GlossaryTermWhereInput, skip: number, take: number): Promise<{
    items: Prisma.GlossaryTermGetPayload<Record<string, never>>[];
    total: number;
  }>;
  findById(where: Prisma.GlossaryTermWhereInput): Promise<Prisma.GlossaryTermGetPayload<Record<string, never>> | null>;
  create(data: Prisma.GlossaryTermUncheckedCreateInput): Promise<Prisma.GlossaryTermGetPayload<Record<string, never>>>;
  update(
    where: Prisma.GlossaryTermWhereInput,
    data: Prisma.GlossaryTermUpdateManyMutationInput,
  ): Promise<boolean>;
  delete(where: Prisma.GlossaryTermWhereInput): Promise<boolean>;
}

export function createGlossaryRepository(
  client: Pick<PrismaClient, 'glossaryTerm'> = prisma,
): GlossaryRepository {
  return {
    async list(where, skip, take) {
      const [items, total] = await Promise.all([
        client.glossaryTerm.findMany({ where, orderBy: { sourceTerm: 'asc' }, skip, take }),
        client.glossaryTerm.count({ where }),
      ]);
      return { items, total };
    },
    findById: (where) => client.glossaryTerm.findFirst({ where }),
    create: (data) => client.glossaryTerm.create({ data }),
    async update(where, data) {
      const result = await client.glossaryTerm.updateMany({ where, data });
      return result.count > 0;
    },
    async delete(where) {
      const result = await client.glossaryTerm.deleteMany({ where });
      return result.count > 0;
    },
  };
}

import { afterAll, describe, expect, it } from 'vitest';

import { env } from '../config/env.js';
import { prisma } from './prisma.js';
import { seedDatabase } from '../../prisma/seed.js';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('database constraints and idempotent seed', () => {
  it('seeds the same permissions, plans, and bootstrap records only once', async () => {
    const before = {
      permissions: await prisma.permission.count(),
      rolePermissions: await prisma.rolePermission.count(),
      plans: await prisma.plan.count(),
      organizations: await prisma.organization.count({ where: { slug: 'demo-enterprise' } }),
      folders: await prisma.folder.count({
        where: { name: { in: ['Personal Knowledge', 'Team Knowledge'] } },
      }),
    };

    await seedDatabase(prisma, {
      adminEmail: env.SEED_SUPER_ADMIN_EMAIL,
      adminPassword: env.SEED_SUPER_ADMIN_PASSWORD,
    });

    const after = {
      permissions: await prisma.permission.count(),
      rolePermissions: await prisma.rolePermission.count(),
      plans: await prisma.plan.count(),
      organizations: await prisma.organization.count({ where: { slug: 'demo-enterprise' } }),
      folders: await prisma.folder.count({
        where: { name: { in: ['Personal Knowledge', 'Team Knowledge'] } },
      }),
    };
    expect(after).toEqual(before);
  });

  it('rejects duplicate active folder names within a parent scope', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: env.SEED_SUPER_ADMIN_EMAIL },
      select: { id: true },
    });
    const name = `Constraint test ${crypto.randomUUID()}`;

    await expect(
      prisma.$transaction(async (transaction) => {
        await transaction.folder.create({
          data: { ownerId: owner.id, name, path: `/${name}`, depth: 0, visibility: 'PRIVATE' },
        });
        await transaction.folder.create({
          data: {
            ownerId: owner.id,
            name: name.toUpperCase(),
            path: `/${name}/duplicate`,
            depth: 0,
            visibility: 'PRIVATE',
          },
        });
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects negative wallet balances', async () => {
    const account = await prisma.billingAccount.findUniqueOrThrow({
      where: {
        ownerType_ownerId: {
          ownerType: 'USER',
          ownerId: (
            await prisma.user.findUniqueOrThrow({
              where: { email: env.SEED_SUPER_ADMIN_EMAIL },
              select: { id: true },
            })
          ).id,
        },
      },
      select: { id: true },
    });

    await expect(
      prisma.$transaction(async (transaction) =>
        transaction.wallet.update({
          where: { billingAccountId: account.id },
          data: { balanceCredits: -1n },
        }),
      ),
    ).rejects.toThrow('wallets_balance_credits_non_negative');
  });
});

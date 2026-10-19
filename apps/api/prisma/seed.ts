import argon2 from 'argon2';
import { PERMISSIONS, ROLE_PERMISSIONS } from '@meetx/shared';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { env } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';

type SeedClient = Prisma.TransactionClient;

const rolePermissions: Record<string, readonly string[]> = ROLE_PERMISSIONS;

const defaultPlans = [
  {
    code: 'free',
    name: 'Free',
    description: 'Free plan; configure included usage before launch.',
    interval: 'MONTH',
    allowedIntervals: ['MONTH'],
    audience: 'ANY',
    isActive: false,
    isPublic: false,
  },
  {
    code: 'pro-monthly',
    name: 'Pro',
    description: 'Inactive demo plan. Configure price and quotas before activation.',
    interval: 'MONTH',
    allowedIntervals: ['DAY', 'WEEK', 'MONTH', 'YEAR', 'CUSTOM'],
    audience: 'INDIVIDUAL',
    isActive: false,
    isPublic: false,
  },
  {
    code: 'business-yearly',
    name: 'Business',
    description: 'Inactive demo plan. Configure price and quotas before activation.',
    interval: 'YEAR',
    allowedIntervals: ['DAY', 'WEEK', 'MONTH', 'YEAR', 'CUSTOM'],
    audience: 'ENTERPRISE',
    isActive: false,
    isPublic: false,
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'Inactive demo plan. Configure price and quotas before activation.',
    interval: 'YEAR',
    allowedIntervals: ['DAY', 'WEEK', 'MONTH', 'YEAR', 'CUSTOM'],
    audience: 'ENTERPRISE',
    isActive: false,
    isPublic: false,
  },
] as const;

async function seedPermissions(client: SeedClient): Promise<void> {
  for (const permissionKey of PERMISSIONS) {
    await client.permission.upsert({
      where: { key: permissionKey },
      create: {
        key: permissionKey,
        description: permissionKey.replaceAll('.', ' '),
        scope: permissionKey.startsWith('org.') ? 'ORG' : 'PLATFORM',
      },
      update: {},
    });
  }

  for (const [role, keys] of Object.entries(rolePermissions)) {
    for (const permissionKey of keys) {
      await client.rolePermission.upsert({
        where: { role_permissionKey: { role, permissionKey } },
        create: { role, permissionKey },
        update: {},
      });
    }
  }
}

async function seedBootstrapAdmin(
  client: SeedClient,
  email: string,
  password: string | undefined,
): Promise<{ id: string }> {
  const existing = await client.user.findUnique({
    where: { email },
    select: { id: true, platformRole: true },
  });
  if (existing) {
    if (existing.platformRole !== 'SUPER_ADMIN') {
      throw new Error(`Seed admin ${email} already exists without the SUPER_ADMIN role.`);
    }
    return existing;
  }
  if (!password || password.length < 12) {
    throw new Error(
      'Set SEED_SUPER_ADMIN_PASSWORD to a unique password of at least 12 characters.',
    );
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  return client.user.create({
    data: {
      email,
      name: 'Platform Owner',
      passwordHash,
      mustChangePassword: true,
      platformRole: 'SUPER_ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
}

async function seedPlans(client: SeedClient): Promise<void> {
  for (const plan of defaultPlans) {
    await client.plan.upsert({
      where: { code: plan.code },
      create: {
        ...plan,
        allowedIntervals: [...plan.allowedIntervals],
        priceMinor: 0n,
        currency: 'USD',
        intervalCount: 1,
        includedInterpretMinutes: 0,
        includedAiTokens: 0n,
        storageQuotaBytes: 0n,
        maxDocuments: 0,
        maxMembers: 1,
        features: {},
      },
      update: {},
    });
  }
}

async function seedOrganization(client: SeedClient, ownerUserId: string): Promise<{ id: string }> {
  const organization = await client.organization.upsert({
    where: { slug: 'demo-enterprise' },
    create: {
      name: 'Demo Enterprise',
      slug: 'demo-enterprise',
      ownerUserId,
      status: 'ACTIVE',
      settings: { demo: true },
    },
    update: {},
    select: { id: true },
  });
  await client.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: ownerUserId } },
    create: {
      organizationId: organization.id,
      userId: ownerUserId,
      orgRole: 'ORG_ADMIN',
      status: 'ACTIVE',
      joinedAt: new Date(),
    },
    update: {},
  });
  return organization;
}

async function seedBillingAccount(
  client: SeedClient,
  ownerType: 'USER' | 'ORGANIZATION',
  ownerId: string,
): Promise<void> {
  const account = await client.billingAccount.upsert({
    where: { ownerType_ownerId: { ownerType, ownerId } },
    create: { ownerType, ownerId, currency: 'USD' },
    update: {},
  });
  await client.wallet.upsert({
    where: { billingAccountId: account.id },
    create: { billingAccountId: account.id, balanceCredits: 0n },
    update: {},
  });
}

async function seedDemoFolders(
  client: SeedClient,
  ownerUserId: string,
  organizationId: string,
): Promise<void> {
  const folders = [
    {
      name: 'Personal Knowledge',
      path: '/Personal Knowledge',
      organizationId: null,
      visibility: 'PRIVATE' as const,
    },
    {
      name: 'Team Knowledge',
      path: '/Team Knowledge',
      organizationId,
      visibility: 'ORGANIZATION' as const,
    },
  ];
  for (const folder of folders) {
    const existing = await client.folder.findFirst({
      where: {
        ownerId: ownerUserId,
        organizationId: folder.organizationId,
        parentId: null,
        name: folder.name,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!existing) {
      await client.folder.create({
        data: {
          ...folder,
          ownerId: ownerUserId,
          depth: 0,
        },
      });
    }
  }
}

async function seedSystemSettings(client: SeedClient): Promise<void> {
  const defaults = [
    ['billing.markup', { value: 2.5 }],
    ['billing.credit_usd', { value: 0.01 }],
    ['billing.plans.require_configuration', { value: true }],
    ['upload.max_mb', { value: 100 }],
    ['registration.enabled', { value: true }],
  ] as const;

  for (const [key, value] of defaults) {
    await client.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  }
}

/** Seeds authorization, inactive plan templates, and the first platform administrator safely. */
export async function seedDatabase(
  prisma: PrismaClient,
  options: { adminEmail: string; adminPassword?: string },
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await seedPermissions(transaction);
    await seedPlans(transaction);
    const admin = await seedBootstrapAdmin(transaction, options.adminEmail, options.adminPassword);
    const organization = await seedOrganization(transaction, admin.id);
    await seedBillingAccount(transaction, 'USER', admin.id);
    await seedBillingAccount(transaction, 'ORGANIZATION', organization.id);
    await seedDemoFolders(transaction, admin.id, organization.id);
    await seedSystemSettings(transaction);
  });
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await seedDatabase(prisma, {
      adminEmail: env.SEED_SUPER_ADMIN_EMAIL,
      adminPassword: env.SEED_SUPER_ADMIN_PASSWORD,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Database seed failed');
  process.exitCode = 1;
});

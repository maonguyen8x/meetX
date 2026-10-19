import type { Prisma } from '@prisma/client';

type Tx = Pick<Prisma.TransactionClient, 'billingAccount' | 'wallet' | 'interpreterSettings'>;

export async function provisionUserDefaults(
  client: Tx,
  userId: string,
  billingEmail: string,
): Promise<void> {
  const account = await client.billingAccount.create({
    data: { ownerType: 'USER', ownerId: userId, billingEmail },
    select: { id: true },
  });
  await client.wallet.create({ data: { billingAccountId: account.id, balanceCredits: 0n } });
  await client.interpreterSettings.create({ data: { userId } });
}

export async function provisionOrganizationBilling(
  client: Pick<Prisma.TransactionClient, 'billingAccount' | 'wallet'>,
  organizationId: string,
  billingEmail: string | null,
): Promise<void> {
  const account = await client.billingAccount.create({
    data: { ownerType: 'ORGANIZATION', ownerId: organizationId, billingEmail },
    select: { id: true },
  });
  await client.wallet.create({ data: { billingAccountId: account.id, balanceCredits: 0n } });
}

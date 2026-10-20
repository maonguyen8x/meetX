import type { Prisma } from '@prisma/client';
import { buildActor } from '../../authorization/policy.js';
import type { Actor } from '../../authorization/policy.js';
import { describe, expect, it, vi } from 'vitest';

import type { GlossaryRepository } from './glossary.repository.js';
import { createMemoryService } from './memory.service.js';

const ORG_ID = '2d7b506d-a029-48fd-a6c0-cba2d9ed5909';
const TERM_ID = '30a9fda1-87cf-4b59-9837-3b36512a38e0';
const glossaryTerm: Prisma.GlossaryTermGetPayload<Record<string, never>> = {
  id: TERM_ID,
  ownerUserId: '23588b08-ad5e-49a8-b1de-06d773971b03',
  organizationId: null,
  sourceLang: 'en',
  targetLang: 'ja',
  sourceTerm: 'meeting',
  targetTerm: '会議',
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMember(): Actor {
  return buildActor({
    id: glossaryTerm.ownerUserId ?? '',
    email: 'member@example.com',
    platformRole: 'USER',
    status: 'ACTIVE',
    rolePermissions: {
      USER: ['interpreter.use'],
      ORG_MEMBER: ['interpreter.use'],
      ORG_ADMIN: ['interpreter.use', 'org.settings.manage'],
    },
    memberships: [
      {
        organizationId: ORG_ID,
        orgRole: 'ORG_MEMBER',
        isOwner: false,
        membershipActive: true,
        organizationActive: true,
      },
    ],
    overrides: [],
  });
}

describe('memory service', () => {
  it('creates organization terms only for a member with organization settings permission', async () => {
    const repository = {
      list: vi.fn<GlossaryRepository['list']>().mockResolvedValue({ items: [], total: 0 }),
      findById: vi.fn<GlossaryRepository['findById']>().mockResolvedValue(glossaryTerm),
      create: vi.fn<GlossaryRepository['create']>().mockResolvedValue({
        ...glossaryTerm,
        ownerUserId: null,
        organizationId: ORG_ID,
      }),
      update: vi.fn<GlossaryRepository['update']>().mockResolvedValue(true),
      delete: vi.fn<GlossaryRepository['delete']>().mockResolvedValue(true),
    } satisfies GlossaryRepository;
    const service = createMemoryService(repository);

    await expect(
      service.create(createMember(), {
        organizationId: ORG_ID,
        sourceLang: 'en',
        targetLang: 'ja',
        sourceTerm: 'meeting',
        targetTerm: '会議',
      }),
    ).rejects.toThrow('You do not have permission');
    expect(repository.create).not.toHaveBeenCalled();

    const orgAdmin = buildActor({
      id: glossaryTerm.ownerUserId ?? '',
      email: 'admin@example.com',
      platformRole: 'USER',
      status: 'ACTIVE',
      rolePermissions: {
        USER: ['interpreter.use'],
        ORG_ADMIN: ['interpreter.use', 'org.settings.manage'],
      },
      memberships: [
        {
          organizationId: ORG_ID,
          orgRole: 'ORG_ADMIN',
          isOwner: true,
          membershipActive: true,
          organizationActive: true,
        },
      ],
      overrides: [],
    });
    const created = await service.create(orgAdmin, {
      organizationId: ORG_ID,
      sourceLang: 'en',
      targetLang: 'ja',
      sourceTerm: 'meeting',
      targetTerm: '会議',
    });

    expect(created.organizationId).toBe(ORG_ID);
    expect(created.ownerUserId).toBeNull();
  });

  it('keeps glossary list queries inside the caller personal and organization scope', async () => {
    const repository = {
      list: vi.fn<GlossaryRepository['list']>().mockResolvedValue({ items: [], total: 0 }),
      findById: vi.fn<GlossaryRepository['findById']>().mockResolvedValue(null),
      create: vi.fn<GlossaryRepository['create']>().mockResolvedValue(glossaryTerm),
      update: vi.fn<GlossaryRepository['update']>().mockResolvedValue(false),
      delete: vi.fn<GlossaryRepository['delete']>().mockResolvedValue(false),
    } satisfies GlossaryRepository;

    await createMemoryService(repository).list(createMember(), { page: 1, limit: 20 });

    const where = repository.list.mock.calls[0]?.[0] as Prisma.GlossaryTermWhereInput;
    expect(where.OR).toContainEqual({ ownerUserId: glossaryTerm.ownerUserId });
    expect(where.OR).toContainEqual({ organizationId: { in: [ORG_ID] } });
  });
});

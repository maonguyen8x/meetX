import type { Prisma } from '@prisma/client';
import type {
  CreateGlossaryTerm,
  UpdateGlossaryTerm,
} from '@meetx/shared/schemas/meeting';
import { glossaryListResponseSchema, glossaryTermResponseSchema } from '@meetx/shared/schemas/meeting';
import type { listGlossaryQuerySchema } from '@meetx/shared/schemas/meeting';
import type { Actor } from '../../authorization/policy.js';
import { can } from '../../authorization/policy.js';
import type { z } from 'zod';

import { forbidden, notFound } from '../../utils/app-errors.js';
import { AppError } from '../../utils/errors.js';
import type { GlossaryRepository } from './glossary.repository.js';

type GlossaryQuery = z.infer<typeof listGlossaryQuerySchema>;

export function createMemoryService(repository: GlossaryRepository) {
  async function list(actor: Actor, query: GlossaryQuery) {
    if (!hasAnyGlossaryAccess(actor)) throw forbidden();
    const where: Prisma.GlossaryTermWhereInput = glossaryScope(actor, query.organizationId);
    if (query.sourceLang) where.sourceLang = query.sourceLang;
    if (query.targetLang) where.targetLang = query.targetLang;
    const { items, total } = await repository.list(where, (query.page - 1) * query.limit, query.limit);
    return glossaryListResponseSchema.parse({
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    });
  }

  async function create(actor: Actor, input: CreateGlossaryTerm) {
    if (!can(actor, 'interpreter.use')) throw forbidden();
    if (input.organizationId) requireOrgPermission(actor, input.organizationId, 'org.settings.manage');
    const term = await repository.create({
      ownerUserId: input.organizationId ? null : actor.id,
      organizationId: input.organizationId ?? null,
      sourceLang: input.sourceLang,
      targetLang: input.targetLang,
      sourceTerm: input.sourceTerm,
      targetTerm: input.targetTerm,
      note: input.note ?? null,
    });
    return glossaryTermResponseSchema.parse(term);
  }

  async function update(actor: Actor, id: string, input: UpdateGlossaryTerm) {
    const term = await findAccessible(actor, id);
    authorizeMutation(actor, term.ownerUserId, term.organizationId);
    const sourceLang = input.sourceLang ?? term.sourceLang;
    const targetLang = input.targetLang ?? term.targetLang;
    if (sourceLang === targetLang) {
      throw new AppError(
        'INVALID_LANGUAGE_PAIR',
        'Source and target languages must be different.',
        400,
      );
    }
    const updated = await repository.update(
      glossaryMutationScope(actor, id),
      {
        ...input,
        ...(input.note === undefined ? {} : { note: input.note }),
      },
    );
    if (!updated) throw notFound('Glossary term not found.');
    const result = await repository.findById(glossaryMutationScope(actor, id));
    if (!result) throw notFound('Glossary term not found.');
    return glossaryTermResponseSchema.parse(result);
  }

  async function remove(actor: Actor, id: string): Promise<void> {
    const term = await findAccessible(actor, id);
    authorizeMutation(actor, term.ownerUserId, term.organizationId);
    const deleted = await repository.delete(glossaryMutationScope(actor, id));
    if (!deleted) throw notFound('Glossary term not found.');
  }

  async function findAccessible(actor: Actor, id: string) {
    const term = await repository.findById(glossaryMutationScope(actor, id));
    if (!term) throw notFound('Glossary term not found.');
    return term;
  }

  return { list, create, update, remove };
}

function glossaryScope(actor: Actor, organizationId?: string) {
  if (organizationId) {
    requireOrgPermission(actor, organizationId, 'interpreter.use');
    return { organizationId };
  }
  const organizationIds = actor.memberships
    .filter((membership) =>
      can(actor, 'interpreter.use', { organizationId: membership.organizationId }),
    )
    .map((membership) => membership.organizationId);
  return {
    OR: [
      ...(can(actor, 'interpreter.use') ? [{ ownerUserId: actor.id }] : []),
      ...(organizationIds.length ? [{ organizationId: { in: organizationIds } }] : []),
    ],
  };
}

function hasAnyGlossaryAccess(actor: Actor): boolean {
  return (
    can(actor, 'interpreter.use') ||
    actor.memberships.some((membership) =>
      can(actor, 'interpreter.use', { organizationId: membership.organizationId }),
    )
  );
}

function glossaryMutationScope(actor: Actor, id: string) {
  const organizationIds = actor.memberships
    .filter((membership) =>
      can(actor, 'org.settings.manage', { organizationId: membership.organizationId }),
    )
    .map((membership) => membership.organizationId);
  return {
    id,
    OR: [
      ...(can(actor, 'interpreter.use') ? [{ ownerUserId: actor.id }] : []),
      ...(organizationIds.length ? [{ organizationId: { in: organizationIds } }] : []),
    ],
  };
}

function authorizeMutation(actor: Actor, ownerUserId: string | null, organizationId: string | null) {
  if (ownerUserId === actor.id && can(actor, 'interpreter.use')) return;
  if (organizationId) requireOrgPermission(actor, organizationId, 'org.settings.manage');
  else throw notFound('Glossary term not found.');
}

function requireOrgPermission(actor: Actor, organizationId: string, permission: string): void {
  const membership = actor.memberships.some((item) => item.organizationId === organizationId);
  if (!membership) throw notFound('Glossary term not found.');
  if (!can(actor, permission, { organizationId })) {
    if (permission === 'interpreter.use') throw notFound('Glossary term not found.');
    throw forbidden();
  }
}

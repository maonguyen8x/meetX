import { can } from '../authorization/policy.js';
import type { Actor } from '../authorization/policy.js';
import { prisma } from '../db/prisma.js';
import type { GlossaryEntry } from '../providers/translate/translate.provider.js';

const MAX_GLOSSARY_TERMS = 200;

export async function canUseMeeting(userId: string, meetingId: string): Promise<boolean> {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, ownerId: userId, deletedAt: null },
    select: { id: true },
  });
  return meeting !== null;
}

/** Terms visible to the actor (personal + organizations where they may use the interpreter), both directions. */
export async function loadGlossary(actor: Actor, source: string, target: string): Promise<GlossaryEntry[]> {
  const organizationIds = actor.memberships
    .filter((membership) => can(actor, 'interpreter.use', { organizationId: membership.organizationId }))
    .map((membership) => membership.organizationId);

  const terms = await prisma.glossaryTerm.findMany({
    where: {
      AND: [
        {
          OR: [
            { ownerUserId: actor.id },
            ...(organizationIds.length ? [{ organizationId: { in: organizationIds } }] : []),
          ],
        },
        {
          OR: [
            { sourceLang: source, targetLang: target },
            { sourceLang: target, targetLang: source },
          ],
        },
      ],
    },
    orderBy: { sourceTerm: 'asc' },
    take: MAX_GLOSSARY_TERMS,
  });

  return terms.map((term) =>
    term.sourceLang === source
      ? { source: term.sourceTerm, target: term.targetTerm }
      : { source: term.targetTerm, target: term.sourceTerm },
  );
}

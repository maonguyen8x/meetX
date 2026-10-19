import type { Prisma } from '@prisma/client';
import type { PlatformRole } from '@meetx/shared';

export interface ScopeActor {
  userId: string;
  organizationIds: readonly string[];
  platformRole: PlatformRole;
}

type ScopedResource = 'folder' | 'document' | 'meeting' | 'room' | 'glossary' | 'conversation';

type ScopeWhere =
  | Prisma.FolderWhereInput
  | Prisma.DocumentWhereInput
  | Prisma.MeetingWhereInput
  | Prisma.RoomWhereInput
  | Prisma.GlossaryTermWhereInput
  | Prisma.ConversationWhereInput;

function folderScope(actor: ScopeActor, organizationIds: string[]): Prisma.FolderWhereInput {
  return {
    deletedAt: null,
    OR: [
      { ownerId: actor.userId },
      ...(organizationIds.length > 0
        ? [{ organizationId: { in: organizationIds }, visibility: 'ORGANIZATION' as const }]
        : []),
    ],
  };
}

function documentScope(actor: ScopeActor, organizationIds: string[]): Prisma.DocumentWhereInput {
  return {
    deletedAt: null,
    OR: [
      { ownerId: actor.userId },
      ...(organizationIds.length > 0
        ? [
            {
              organizationId: { in: organizationIds },
              folder: { visibility: 'ORGANIZATION' as const },
            },
          ]
        : []),
    ],
  };
}

function meetingScope(actor: ScopeActor, organizationIds: string[]): Prisma.MeetingWhereInput {
  return {
    deletedAt: null,
    OR: [
      { ownerId: actor.userId },
      ...(organizationIds.length > 0 ? [{ organizationId: { in: organizationIds } }] : []),
    ],
  };
}

function roomScope(actor: ScopeActor, organizationIds: string[]): Prisma.RoomWhereInput {
  return {
    OR: [
      { ownerId: actor.userId },
      ...(organizationIds.length > 0 ? [{ organizationId: { in: organizationIds } }] : []),
    ],
  };
}

function glossaryScope(
  actor: ScopeActor,
  organizationIds: string[],
): Prisma.GlossaryTermWhereInput {
  return {
    OR: [
      { ownerUserId: actor.userId },
      ...(organizationIds.length > 0 ? [{ organizationId: { in: organizationIds } }] : []),
    ],
  };
}

function conversationScope(
  actor: ScopeActor,
  organizationIds: string[],
): Prisma.ConversationWhereInput {
  return {
    OR: [
      { userId: actor.userId },
      ...(organizationIds.length > 0 ? [{ organizationId: { in: organizationIds } }] : []),
    ],
  };
}

/** Builds pre-retrieval tenant filters; organization IDs must come from active memberships. */
export function scopeByActor(actor: ScopeActor, resource: 'folder'): Prisma.FolderWhereInput;
export function scopeByActor(actor: ScopeActor, resource: 'document'): Prisma.DocumentWhereInput;
export function scopeByActor(actor: ScopeActor, resource: 'meeting'): Prisma.MeetingWhereInput;
export function scopeByActor(actor: ScopeActor, resource: 'room'): Prisma.RoomWhereInput;
export function scopeByActor(
  actor: ScopeActor,
  resource: 'glossary',
): Prisma.GlossaryTermWhereInput;
export function scopeByActor(
  actor: ScopeActor,
  resource: 'conversation',
): Prisma.ConversationWhereInput;
export function scopeByActor(actor: ScopeActor, resource: ScopedResource): ScopeWhere {
  if (actor.platformRole === 'SUPER_ADMIN') return {};

  const organizationIds = [...actor.organizationIds];

  switch (resource) {
    case 'folder':
      return folderScope(actor, organizationIds);
    case 'document':
      return documentScope(actor, organizationIds);
    case 'meeting':
      return meetingScope(actor, organizationIds);
    case 'room':
      return roomScope(actor, organizationIds);
    case 'glossary':
      return glossaryScope(actor, organizationIds);
    case 'conversation':
      return conversationScope(actor, organizationIds);
  }
}

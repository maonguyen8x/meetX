import { describe, expect, it } from 'vitest';

import { scopeByActor } from './scope-by-actor.js';

const actor = {
  userId: 'user-1',
  organizationIds: ['org-1', 'org-2'],
  platformRole: 'USER' as const,
};

describe('scopeByActor', () => {
  it('limits document queries to the actor or their organizations', () => {
    expect(scopeByActor(actor, 'document')).toEqual({
      deletedAt: null,
      OR: [
        { ownerId: 'user-1' },
        {
          organizationId: { in: ['org-1', 'org-2'] },
          folder: { visibility: 'ORGANIZATION' },
        },
      ],
    });
  });

  it('excludes private folders owned by another organization member', () => {
    expect(scopeByActor(actor, 'folder')).toEqual({
      deletedAt: null,
      OR: [
        { ownerId: 'user-1' },
        { organizationId: { in: ['org-1', 'org-2'] }, visibility: 'ORGANIZATION' },
      ],
    });
  });

  it('does not include an empty organization filter', () => {
    expect(scopeByActor({ ...actor, organizationIds: [] }, 'conversation')).toEqual({
      OR: [{ userId: 'user-1' }],
    });
  });

  it('leaves super-admin scope unrestricted', () => {
    expect(scopeByActor({ ...actor, platformRole: 'SUPER_ADMIN' }, 'meeting')).toEqual({});
  });
});

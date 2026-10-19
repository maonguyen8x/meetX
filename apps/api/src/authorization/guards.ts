import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';

import { authenticateRequest } from '../plugins/auth.js';
import { can } from './policy.js';
import type { PolicyResource } from './policy.js';
import { AppError } from '../utils/errors.js';

export interface PermissionGuardOptions {
  /** Route param that carries the organization id for org-scoped permissions. */
  organizationParam?: string;
}

/** Authenticates and coarse-checks a permission; services must still re-check resource ownership. */
export function requirePermission(
  permission: string,
  options: PermissionGuardOptions = {},
): preHandlerAsyncHookHandler {
  return async (request: FastifyRequest) => {
    const actor = await authenticateRequest(request);
    const resource: PolicyResource = {};
    if (options.organizationParam) {
      const params = request.params as Record<string, string | undefined>;
      resource.organizationId = params[options.organizationParam];
    }
    if (!can(actor, permission, resource)) {
      throw new AppError('FORBIDDEN', 'You do not have permission to perform this action.', 403);
    }
  };
}

export const requireAuthenticated: preHandlerAsyncHookHandler = async (request) => {
  await authenticateRequest(request);
};

export const requireAuthenticatedAllowPending: preHandlerAsyncHookHandler = async (request) => {
  await authenticateRequest(request, { allowPasswordChangePending: true });
};

import { z } from 'zod';

import { PERMISSIONS } from '../../permissions.js';
import { emailSchema, localeSchema } from '../auth/index.js';

export const userStatusSchema = z.enum(['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED']);
export const platformRoleSchema = z.enum(['SUPER_ADMIN', 'ADMIN', 'USER']);

export const reauthSchema = z.object({ currentPassword: z.string().min(1).max(128) });

export const listUsersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  role: platformRoleSchema.optional(),
  status: userStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createUserSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1).max(120),
  locale: localeSchema.default('vi'),
});

export const adminUpdateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    locale: localeSchema,
    email: emailSchema,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const deactivateUserSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  status: z.enum(['INACTIVE', 'SUSPENDED']).default('INACTIVE'),
});

export const changeRoleSchema = reauthSchema.extend({ role: platformRoleSchema });

export const permissionOverrideSchema = reauthSchema.extend({
  permissionKey: z.enum(PERMISSIONS),
  effect: z.enum(['ALLOW', 'DENY', 'CLEAR']),
});

export const deleteUserSchema = reauthSchema;

export const listAuditLogsQuerySchema = z.object({
  action: z.string().trim().max(120).optional(),
  actorUserId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

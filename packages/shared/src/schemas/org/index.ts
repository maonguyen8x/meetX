import { z } from 'zod';

import { emailSchema, localeSchema } from '../auth/index.js';
import { reauthSchema } from '../user/index.js';

export const organizationRoleSchema = z.enum(['ORG_ADMIN', 'ORG_MEMBER']);
export const organizationStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']);

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  billingEmail: emailSchema.optional(),
  taxCode: z.string().trim().max(60).optional(),
  address: z.string().trim().max(300).optional(),
});

export const adminCreateOrganizationSchema = createOrganizationSchema.extend({
  ownerEmail: emailSchema,
  ownerName: z.string().trim().min(1).max(120).optional(),
  ownerLocale: localeSchema.default('vi'),
  maxMembers: z.number().int().min(1).max(100_000).optional(),
});

export const updateOrganizationSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    billingEmail: emailSchema.nullable(),
    taxCode: z.string().trim().max(60).nullable(),
    address: z.string().trim().max(300).nullable(),
    logoUrl: z.string().url().max(2048).nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const adminUpdateOrganizationSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    status: organizationStatusSchema,
    maxMembers: z.number().int().min(1).max(100_000).nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const inviteMemberSchema = z.object({
  email: emailSchema,
  orgRole: organizationRoleSchema.default('ORG_MEMBER'),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(20).max(200),
  name: z.string().trim().min(1).max(120).optional(),
  password: z.string().min(12).max(128).optional(),
  locale: localeSchema.default('vi'),
});

export const updateMemberSchema = z
  .object({
    orgRole: organizationRoleSchema,
    status: z.enum(['ACTIVE', 'INACTIVE']),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const memberQuotaSchema = z.object({
  quotas: z
    .array(
      z.object({
        metric: z.enum([
          'INTERPRET_MINUTES',
          'AI_TOKENS',
          'STORAGE_BYTES',
          'DOCUMENT_COUNT',
          'MEMBER_COUNT',
          'SEARCH_QUERIES',
        ]),
        limitValue: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
      }),
    )
    .min(1)
    .max(6),
});

export const deleteOrganizationSchema = reauthSchema;

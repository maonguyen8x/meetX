import { z } from 'zod';

export const localeSchema = z.enum(['vi', 'en', 'ja']);

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters.')
  .max(128);

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    name: z.string().trim().min(1).max(120),
    locale: localeSchema.default('vi'),
    accountKind: z.enum(['individual', 'business']).default('individual'),
    organizationName: z.string().trim().min(2).max(120).optional(),
  })
  .refine((value) => value.accountKind === 'individual' || value.organizationName, {
    path: ['organizationName'],
    message: 'Organization name is required for business accounts.',
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });
export const logoutSchema = z.object({ refreshToken: z.string().min(20).max(200).optional() });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});
export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    locale: localeSchema,
    avatarUrl: z.string().url().max(2048).nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

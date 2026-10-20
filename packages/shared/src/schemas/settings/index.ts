import { z } from 'zod';

const languageCodeSchema = z.enum(['vi', 'en', 'ja']);

const settingsFields = {
  personaName: z.string().trim().min(1).max(80),
  voiceGender: z.enum(['MALE', 'FEMALE', 'NEUTRAL']),
  voiceStyle: z.enum(['WARM', 'PROFESSIONAL', 'ENERGETIC']),
  speed: z.number().min(0.5).max(2),
  volume: z.number().min(0).max(1),
  duckOriginalPct: z.number().int().min(0).max(100),
  triggerMode: z.enum(['AUTO', 'MANUAL', 'SUMMARY']),
  endpointingMs: z.number().int().min(100).max(3000),
  defaultPair: z
    .object({
      sourceLang: languageCodeSchema,
      targetLang: languageCodeSchema,
    })
    .strict()
    .refine((pair) => pair.sourceLang !== pair.targetLang, 'Languages must be different.'),
  saveHistory: z.boolean(),
  storageMode: z.enum(['LOCAL', 'CLOUD']),
} satisfies z.ZodRawShape;

export const settingsResponseSchema = z
  .object({
    ...settingsFields,
    avatarUrl: z.string().nullable(),
  })
  .strict();

export const settingsPatchSchema = z
  .object(settingsFields)
  .partial()
  .strict()
  .refine((settings) => Object.keys(settings).length > 0, 'At least one setting must be provided.');

export const voicePreviewSchema = z.object({ lang: languageCodeSchema }).strict();

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
export type SettingsResponse = z.infer<typeof settingsResponseSchema>;

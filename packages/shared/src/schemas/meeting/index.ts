import { z } from 'zod';

const languageCodeSchema = z.enum(['vi', 'en', 'ja']);

const meetingListItemSchema = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string().uuid().nullable(),
    type: z.enum(['BOT', 'ROOM']),
    title: z.string().nullable(),
    platform: z.enum(['GOOGLE_MEET', 'ZOOM', 'TEAMS', 'INTERNAL']),
    sourceLang: languageCodeSchema,
    targetLang: languageCodeSchema,
    status: z.enum(['CREATED', 'JOINING', 'LIVE', 'ENDED', 'FAILED', 'DENIED']),
    startedAt: z.date().nullable(),
    endedAt: z.date().nullable(),
    durationSec: z.number().int().nullable(),
    createdAt: z.date(),
  })
  .strict();

const meetingTurnSchema = z
  .object({
    id: z.string().uuid(),
    participantId: z.string().uuid().nullable(),
    speakerLabel: z.string().nullable(),
    lang: languageCodeSchema,
    originalText: z.string(),
    translatedText: z.string(),
    emotion: z.string().nullable(),
    startedMs: z.number().int(),
    endedMs: z.number().int(),
    sttConfidence: z.number().nullable(),
  })
  .strict();

const meetingSummaryResponseSchema = z
  .object({
    summary: z.string(),
    actionItems: z.array(z.string()),
    decisions: z.array(z.string()),
    generatedAt: z.date(),
  })
  .strict();

export const meetingListResponseSchema = z
  .object({
    items: z.array(meetingListItemSchema),
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .strict();

export const meetingDetailResponseSchema = meetingListItemSchema
  .extend({
    turns: z.array(meetingTurnSchema),
    summary: meetingSummaryResponseSchema.nullable(),
  })
  .strict();

export const meetingExportResponseSchema = z
  .object({
    body: z.string(),
    contentType: z.string(),
    filename: z.string().regex(/^meeting-[0-9a-f-]+\.(md|json)$/),
  })
  .strict();

export const meetingIdParamSchema = z.object({ id: z.string().uuid() }).strict();

export const listMeetingsQuerySchema = z
  .object({
    organizationId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const exportMeetingQuerySchema = z
  .object({ format: z.enum(['md', 'json']).default('md') })
  .strict();

export const meetingSummarySchema = z
  .object({
    summary: z.string().trim().min(1).max(50_000),
    actionItems: z.array(z.string().trim().min(1).max(2_000)).max(200).default([]),
    decisions: z.array(z.string().trim().min(1).max(2_000)).max(200).default([]),
  })
  .strict();

export const glossaryIdParamSchema = z.object({ id: z.string().uuid() }).strict();

export const glossaryTermResponseSchema = z
  .object({
    id: z.string().uuid(),
    ownerUserId: z.string().uuid().nullable(),
    organizationId: z.string().uuid().nullable(),
    sourceLang: languageCodeSchema,
    targetLang: languageCodeSchema,
    sourceTerm: z.string(),
    targetTerm: z.string(),
    note: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .strict();

export const glossaryListResponseSchema = z
  .object({
    items: z.array(glossaryTermResponseSchema),
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .strict();

export const listGlossaryQuerySchema = z
  .object({
    organizationId: z.string().uuid().optional(),
    sourceLang: languageCodeSchema.optional(),
    targetLang: languageCodeSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const createGlossaryTermSchema = z
  .object({
    organizationId: z.string().uuid().optional(),
    sourceLang: languageCodeSchema,
    targetLang: languageCodeSchema,
    sourceTerm: z.string().trim().min(1).max(200),
    targetTerm: z.string().trim().min(1).max(200),
    note: z.string().trim().max(1_000).optional(),
  })
  .strict()
  .refine((term) => term.sourceLang !== term.targetLang, 'Languages must be different.');

export const updateGlossaryTermSchema = z
  .object({
    sourceLang: languageCodeSchema,
    targetLang: languageCodeSchema,
    sourceTerm: z.string().trim().min(1).max(200),
    targetTerm: z.string().trim().min(1).max(200),
    note: z.string().trim().max(1_000).nullable(),
  })
  .partial()
  .strict()
  .refine((term) => Object.keys(term).length > 0, 'At least one term field must be provided.')
  .refine(
    (term) => term.sourceLang === undefined || term.targetLang === undefined || term.sourceLang !== term.targetLang,
    'Languages must be different.',
  );

export type CreateGlossaryTerm = z.infer<typeof createGlossaryTermSchema>;
export type UpdateGlossaryTerm = z.infer<typeof updateGlossaryTermSchema>;

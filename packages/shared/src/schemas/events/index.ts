import { z } from 'zod';

const languageCodeSchema = z.enum(['vi', 'en', 'ja']);
export const emotionSchema = z.enum([
  'neutral',
  'warm',
  'excited',
  'serious',
  'apologetic',
  'calm',
  'question',
]);
export const interpretModeSchema = z.enum(['translate', 'summarize_turn', 'recap', 'reply_as_assistant']);

export const AUDIO_FRAME_BYTES = 640; // 20 ms of PCM16 mono at 16 kHz
export const MAX_CLIENT_FRAME_BYTES = 8192;

export const clientMessageSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('session.start'),
      sourceLang: languageCodeSchema,
      targetLang: languageCodeSchema,
      mode: interpretModeSchema.default('translate'),
      meetingId: z.string().uuid().optional(),
    })
    .strict()
    .refine((m) => m.sourceLang !== m.targetLang, 'Languages must be different.'),
  z.object({ type: z.literal('translate.now') }).strict(),
  z.object({ type: z.literal('mute.interpreter'), on: z.boolean() }).strict(),
  z.object({ type: z.literal('recap.request') }).strict(),
  z.object({ type: z.literal('session.end') }).strict(),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type InterpretMode = z.infer<typeof interpretModeSchema>;
export type Emotion = z.infer<typeof emotionSchema>;

export type ServerMessage =
  | { type: 'session.ready'; sessionId: string; resumed: boolean }
  | { type: 'turn.start'; turnId: string; speaker: string; lang: string }
  | { type: 'caption.partial' | 'caption.final'; turnId: string; text: string; lang: string }
  | { type: 'translation.text'; turnId: string; text: string; lang: string; emotion?: Emotion }
  | { type: 'translation.audio.start'; turnId: string; format: 'pcm16'; sampleRate: 24000 }
  | { type: 'translation.audio.end'; turnId: string }
  | { type: 'usage.tick'; creditsUsed: number; balance: number; minutesLeft: number }
  | { type: 'error'; code: string; message: string };

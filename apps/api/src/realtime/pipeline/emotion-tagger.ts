import type { Emotion } from '@meetx/shared/schemas/events';
import { emotionSchema } from '@meetx/shared/schemas/events';

const TAG_PATTERN = /\[(warm|excited|serious|apologetic|calm|question)\]/gi;

export interface TaggedSentence {
  text: string;
  emotion: Emotion;
}

/** Extracts the first inline style tag (one per sentence max) and strips every tag from the spoken text. */
export function parseEmotionTag(sentence: string): TaggedSentence {
  let emotion: Emotion = 'neutral';
  const first = TAG_PATTERN.exec(sentence);
  TAG_PATTERN.lastIndex = 0;
  if (first?.[1]) {
    const parsed = emotionSchema.safeParse(first[1].toLowerCase());
    if (parsed.success) emotion = parsed.data;
  }
  const text = sentence.replace(TAG_PATTERN, '').replace(/\s{2,}/g, ' ').trim();
  return { text, emotion };
}

const EMOTION_SPEED: Record<Emotion, number> = {
  neutral: 1,
  warm: 0.97,
  excited: 1.08,
  serious: 0.95,
  apologetic: 0.95,
  calm: 0.96,
  question: 1.02,
};

/** Emotion speed stays in 0.95-1.1; the user's speed setting scales it within the provider limits. */
export function resolveSpeed(emotion: Emotion, userSpeed: number): number {
  const value = EMOTION_SPEED[emotion] * userSpeed;
  return Math.round(Math.min(1.2, Math.max(0.7, value)) * 100) / 100;
}

export interface ElevenLabsVoiceSettings {
  stability: number;
  style: number;
  speed: number;
}

const ELEVEN_BASE: Record<Emotion, { stability: number; style: number }> = {
  neutral: { stability: 0.5, style: 0.2 },
  warm: { stability: 0.45, style: 0.45 },
  excited: { stability: 0.3, style: 0.7 },
  serious: { stability: 0.7, style: 0.15 },
  apologetic: { stability: 0.55, style: 0.35 },
  calm: { stability: 0.75, style: 0.1 },
  question: { stability: 0.4, style: 0.4 },
};

export function toElevenLabsSettings(emotion: Emotion, userSpeed: number): ElevenLabsVoiceSettings {
  return { ...ELEVEN_BASE[emotion], speed: resolveSpeed(emotion, userSpeed) };
}

const OPENAI_INSTRUCTION: Record<Emotion, string> = {
  neutral: 'Speak naturally and clearly, like a professional interpreter.',
  warm: 'Speak in a warm, friendly and caring tone.',
  excited: 'Speak with genuine enthusiasm and energy, without shouting.',
  serious: 'Speak in a serious, measured and composed tone.',
  apologetic: 'Speak in a sincere, soft and apologetic tone.',
  calm: 'Speak in a calm, reassuring and unhurried tone.',
  question: 'Speak with a natural rising, inquisitive intonation.',
};

export function toOpenAiInstruction(emotion: Emotion, style: 'WARM' | 'PROFESSIONAL' | 'ENERGETIC'): string {
  const styleHint =
    style === 'WARM' ? ' Overall style: warm.' : style === 'ENERGETIC' ? ' Overall style: energetic.' : ' Overall style: professional.';
  return OPENAI_INSTRUCTION[emotion] + styleHint;
}

/** A closing punctuation mark gives TTS engines a natural sentence-end pause. */
export function ensureSentenceEnd(text: string): string {
  return /[.!?。！？…]$/.test(text) ? text : `${text}.`;
}

import { describe, expect, it } from 'vitest';

import {
  ensureSentenceEnd,
  parseEmotionTag,
  resolveSpeed,
  toElevenLabsSettings,
  toOpenAiInstruction,
} from './emotion-tagger.js';

describe('parseEmotionTag', () => {
  it('extracts the tag and strips it from the text', () => {
    expect(parseEmotionTag('[warm] Thank you very much.')).toEqual({ text: 'Thank you very much.', emotion: 'warm' });
    expect(parseEmotionTag('ご迷惑をおかけしました。[apologetic]')).toEqual({
      text: 'ご迷惑をおかけしました。',
      emotion: 'apologetic',
    });
  });

  it('falls back to neutral when no tag is present', () => {
    expect(parseEmotionTag('Plain sentence.')).toEqual({ text: 'Plain sentence.', emotion: 'neutral' });
  });

  it('uses the first tag and strips extras; unknown tags stay as text', () => {
    expect(parseEmotionTag('[calm] a [serious] b')).toEqual({ text: 'a b', emotion: 'calm' });
    expect(parseEmotionTag('[loud] a').emotion).toBe('neutral');
  });

  it('works repeatedly (no stale regex state)', () => {
    expect(parseEmotionTag('[excited] one').emotion).toBe('excited');
    expect(parseEmotionTag('[excited] two').emotion).toBe('excited');
  });
});

describe('provider mapping', () => {
  it('keeps the emotion speed in the 0.95-1.1 range at user speed 1', () => {
    for (const emotion of ['neutral', 'warm', 'excited', 'serious', 'apologetic', 'calm', 'question'] as const) {
      const speed = resolveSpeed(emotion, 1);
      expect(speed).toBeGreaterThanOrEqual(0.95);
      expect(speed).toBeLessThanOrEqual(1.1);
    }
  });

  it('scales by user speed within provider limits', () => {
    expect(resolveSpeed('neutral', 5)).toBe(1.2);
    expect(resolveSpeed('neutral', 0.1)).toBe(0.7);
  });

  it('maps emotions to different ElevenLabs settings', () => {
    expect(toElevenLabsSettings('excited', 1).stability).toBeLessThan(toElevenLabsSettings('calm', 1).stability);
  });

  it('produces OpenAI instructions that include the style', () => {
    expect(toOpenAiInstruction('warm', 'ENERGETIC')).toContain('energetic');
  });

  it('adds a terminal mark for a natural pause', () => {
    expect(ensureSentenceEnd('Hello')).toBe('Hello.');
    expect(ensureSentenceEnd('こんにちは。')).toBe('こんにちは。');
  });
});

import { describe, expect, it } from 'vitest';

import { silenceFrames, speechFrames } from '../../../test/fakes/audio.js';
import { FakeSttProvider } from '../../../test/fakes/fake-stt.js';
import { FakeTranslateProvider } from '../../../test/fakes/fake-translate.js';
import { FakeTtsProvider } from '../../../test/fakes/fake-tts.js';
import { StubUsageHooks } from '../usage-hooks.js';
import { PipelineOrchestrator, isAddressedTo } from './orchestrator.js';
import type { PipelineConfig, PipelineEvent } from './orchestrator.js';

const BASE: PipelineConfig = {
  userId: 'u1',
  sessionId: 's1',
  sourceLang: 'vi',
  targetLang: 'ja',
  mode: 'translate',
  persona: { name: 'Aiko' },
  voice: { gender: 'FEMALE', style: 'WARM' },
  speed: 1,
  endpointingMs: 300,
  triggerMode: 'AUTO',
  glossary: [{ source: 'giao hàng', target: '納品' }],
  sttFinalTimeoutMs: 50,
};

function setup(
  options: {
    script?: string[];
    translations?: Record<string, string>;
    config?: Partial<PipelineConfig>;
    ttsFail?: Error;
    translateFail?: Error;
    sttLang?: 'vi' | 'ja' | 'en';
    confidence?: number;
  } = {},
) {
  const events: PipelineEvent[] = [];
  const translate = new FakeTranslateProvider({
    ...(options.translations ? { translations: options.translations } : {}),
    ...(options.translateFail ? { failWith: options.translateFail } : {}),
  });
  const tts = new FakeTtsProvider(options.ttsFail ? { failWith: options.ttsFail } : {});
  const usage = new StubUsageHooks();
  const orchestrator = new PipelineOrchestrator(
    { ...BASE, ...options.config },
    {
      stt: new FakeSttProvider({
        script: options.script ?? ['Xin chào'],
        lang: options.sttLang ?? 'vi',
        ...(options.confidence !== undefined ? { confidence: options.confidence } : {}),
      }),
      translate,
      tts,
      usage,
      emit: (event) => events.push(event),
    },
  );
  const speak = (ms: number) => speechFrames(ms).forEach((f) => orchestrator.pushAudio(f));
  const silence = (ms: number) => silenceFrames(ms).forEach((f) => orchestrator.pushAudio(f));
  return { orchestrator, events, translate, tts, usage, speak, silence };
}

const types = (events: PipelineEvent[]) => events.map((e) => e.type);

describe('PipelineOrchestrator', () => {
  it('runs STT -> translate -> TTS in protocol order for one turn', async () => {
    const t = setup({ translations: { 'Xin chào': '[warm] こんにちは。' } });
    await t.orchestrator.start();
    t.speak(1000);
    t.silence(400);
    await t.orchestrator.end();

    const dedupe = new Set(['audio', 'caption.partial']);
    const order = types(t.events).filter((type, i, all) => !dedupe.has(type) || all[i - 1] !== type);
    expect(order).toEqual([
      'turn.start',
      'caption.partial',
      'caption.final',
      'translation.text',
      'audio.start',
      'audio',
      'audio.end',
      'latency',
      'usage',
    ]);
    const text = t.events.find((e) => e.type === 'translation.text');
    expect(text).toMatchObject({ text: 'こんにちは。', lang: 'ja', emotion: 'warm' });
    expect(t.tts.requests[0]).toMatchObject({ lang: 'ja', emotion: 'warm', voice: { gender: 'FEMALE' } });
  });

  it('passes persona, glossary and rolling context to the translator', async () => {
    const t = setup({ script: ['một', 'hai'] });
    await t.orchestrator.start();
    t.speak(600);
    t.silence(400);
    await new Promise((resolve) => setTimeout(resolve, 20));
    t.speak(600);
    t.silence(400);
    await t.orchestrator.end();

    expect(t.translate.requests).toHaveLength(2);
    expect(t.translate.requests[0]).toMatchObject({
      persona: { name: 'Aiko' },
      glossary: [{ source: 'giao hàng', target: '納品' }],
      source: 'vi',
      target: 'ja',
      lastTurns: [],
    });
    expect(t.translate.requests[1]?.lastTurns).toEqual([{ speaker: 'speaker', text: 'một' }]);
  });

  it('overlaps sentences: one audio block per turn containing every sentence', async () => {
    const t = setup({ translations: { 'Xin chào': 'こんにちは。お元気ですか？はい。' } });
    await t.orchestrator.start();
    t.speak(600);
    t.silence(400);
    await t.orchestrator.end();

    expect(t.events.filter((e) => e.type === 'translation.text')).toHaveLength(3);
    expect(t.events.filter((e) => e.type === 'audio.start')).toHaveLength(1);
    expect(t.events.filter((e) => e.type === 'audio.end')).toHaveLength(1);
    expect(t.tts.requests).toHaveLength(3);
  });

  it('reports usage for metering', async () => {
    const t = setup();
    await t.orchestrator.start();
    t.speak(1000);
    t.silence(400);
    await t.orchestrator.end();

    expect(t.usage.records).toHaveLength(1);
    const record = t.usage.records[0];
    expect(record?.sttSeconds).toBeCloseTo(1.4, 1);
    expect(record?.llmOutputTokens).toBeGreaterThan(0);
    expect(record?.ttsCharacters).toBeGreaterThan(0);
    expect(t.events.some((e) => e.type === 'usage')).toBe(true);
  });

  it('logs per-stage latency without content', async () => {
    const t = setup();
    await t.orchestrator.start();
    t.speak(600);
    t.silence(400);
    await t.orchestrator.end();
    const latency = t.events.find((e) => e.type === 'latency');
    expect(latency).toBeDefined();
    expect(Object.keys(latency ?? {}).sort()).toEqual(['sttMs', 'translateFirstMs', 'ttsFirstMs', 'totalMs', 'turnId', 'type'].sort());
  });

  it('skips TTS when the interpreter is muted but still sends text', async () => {
    const t = setup();
    await t.orchestrator.start();
    t.orchestrator.setMuted(true);
    t.speak(600);
    t.silence(400);
    await t.orchestrator.end();
    expect(t.events.some((e) => e.type === 'translation.text')).toBe(true);
    expect(t.events.some((e) => e.type === 'audio')).toBe(false);
    expect(t.tts.requests).toHaveLength(0);
  });

  it('keeps the text caption when TTS fails', async () => {
    const t = setup({ ttsFail: new Error('boom') });
    await t.orchestrator.start();
    t.speak(600);
    t.silence(400);
    await t.orchestrator.end();
    expect(t.events.some((e) => e.type === 'translation.text')).toBe(true);
    expect(t.events.find((e) => e.type === 'error')).toMatchObject({ code: 'TTS_FAILED' });
    expect(t.events.some((e) => e.type === 'audio.start')).toBe(false);
  });

  it('reports translate failures without leaking provider details', async () => {
    const t = setup({ translateFail: new Error('secret upstream detail') });
    await t.orchestrator.start();
    t.speak(600);
    t.silence(400);
    await t.orchestrator.end();
    const error = t.events.find((e) => e.type === 'error');
    expect(error).toMatchObject({ code: 'TRANSLATE_FAILED' });
    expect(JSON.stringify(error)).not.toContain('secret');
  });

  it('translates immediately on the manual override even without silence', async () => {
    const t = setup({ config: { triggerMode: 'MANUAL' } });
    await t.orchestrator.start();
    t.speak(600);
    t.silence(2000);
    expect(t.events.some((e) => e.type === 'caption.final')).toBe(false);
    t.orchestrator.translateNow();
    await t.orchestrator.end();
    expect(t.events.some((e) => e.type === 'translation.text')).toBe(true);
  });

  it('translates in the opposite direction when auto-detect hears the target language', async () => {
    const t = setup({ config: { autoDetect: true }, sttLang: 'ja', script: ['はい'] });
    await t.orchestrator.start();
    t.speak(600);
    t.silence(400);
    await t.orchestrator.end();
    expect(t.translate.requests[0]).toMatchObject({ source: 'ja', target: 'vi' });
  });

  it('keeps the configured pair when language confidence is low', async () => {
    const t = setup({ config: { autoDetect: true }, sttLang: 'ja', confidence: 0.4, script: ['はい'] });
    await t.orchestrator.start();
    t.speak(600);
    t.silence(400);
    await t.orchestrator.end();
    expect(t.translate.requests[0]).toMatchObject({ source: 'vi', target: 'ja' });
  });

  it('switches to reply_as_assistant when addressed by name', async () => {
    const t = setup({ script: ['Aiko, bạn có thể giúp tôi không?'] });
    await t.orchestrator.start();
    t.speak(600);
    t.silence(400);
    await t.orchestrator.end();
    expect(t.translate.requests[0]).toMatchObject({ mode: 'reply_as_assistant' });
    expect(t.events.find((e) => e.type === 'translation.text')).toMatchObject({ lang: 'vi' });
  });

  it('generates a recap on request', async () => {
    const t = setup();
    await t.orchestrator.start();
    t.orchestrator.recap();
    await t.orchestrator.end();
    expect(t.translate.requests[0]).toMatchObject({ mode: 'recap' });
    expect(t.usage.records).toHaveLength(0);
  });

  it('ignores audio with no speech', async () => {
    const t = setup();
    await t.orchestrator.start();
    t.silence(2000);
    await t.orchestrator.end();
    expect(t.events).toEqual([]);
  });
});

describe('isAddressedTo', () => {
  it('requires the name at the start followed by a separator', () => {
    expect(isAddressedTo('Aiko, can you help', 'Aiko')).toBe(true);
    expect(isAddressedTo('aiko: hello', 'Aiko')).toBe(true);
    expect(isAddressedTo('Aikos house', 'Aiko')).toBe(false);
    expect(isAddressedTo('tell Aiko', 'Aiko')).toBe(false);
  });
});

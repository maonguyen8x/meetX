/**
 * Streams a WAV file (PCM16 mono 16 kHz) through the realtime pipeline and saves the translated audio.
 *
 *   pnpm --filter @meetx/api demo:cli                 # fake providers, generated vi sample
 *   pnpm --filter @meetx/api demo:cli -- --input a.wav --source vi --target ja --live
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { LANGUAGES } from '@meetx/shared';
import type { LanguageCode } from '@meetx/shared';

import { FRAME_MS, silenceFrames, speechFrames } from '../test/fakes/audio.js';
import { FakeSttProvider } from '../test/fakes/fake-stt.js';
import { FakeTranslateProvider } from '../test/fakes/fake-translate.js';
import { FakeTtsProvider } from '../test/fakes/fake-tts.js';
import { PipelineOrchestrator } from '../src/realtime/pipeline/orchestrator.js';
import type { PipelineEvent } from '../src/realtime/pipeline/orchestrator.js';
import { StubUsageHooks } from '../src/realtime/usage-hooks.js';
import type { RealtimeProviders } from '../src/realtime/gateway.js';

const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    output: { type: 'string', default: 'demo-output/translated.wav' },
    source: { type: 'string', default: 'vi' },
    target: { type: 'string', default: 'ja' },
    live: { type: 'boolean', default: false },
    realtime: { type: 'boolean', default: false },
  },
});

function toLanguage(value: string): LanguageCode {
  if (value in LANGUAGES) return value as LanguageCode;
  throw new Error(`Unsupported language "${value}". Use one of: ${Object.keys(LANGUAGES).join(', ')}`);
}

function wavHeader(dataBytes: number, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataBytes, 40);
  return header;
}

function readWavPcm(path: string): Uint8Array {
  const file = readFileSync(path);
  if (file.toString('ascii', 0, 4) !== 'RIFF' || file.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Input is not a WAV file.');
  }
  let offset = 12;
  let formatOk = false;
  while (offset + 8 <= file.length) {
    const id = file.toString('ascii', offset, offset + 4);
    const size = file.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      formatOk =
        file.readUInt16LE(offset + 8) === 1 &&
        file.readUInt16LE(offset + 10) === 1 &&
        file.readUInt32LE(offset + 12) === 16000 &&
        file.readUInt16LE(offset + 22) === 16;
    } else if (id === 'data') {
      if (!formatOk) throw new Error('WAV must be PCM16 mono 16 kHz.');
      return new Uint8Array(file.subarray(offset + 8, offset + 8 + size));
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error('WAV has no data chunk.');
}

function framesFromPcm(pcm: Uint8Array): Uint8Array[] {
  const frameBytes = (16000 * 2 * FRAME_MS) / 1000;
  const frames: Uint8Array[] = [];
  for (let i = 0; i + frameBytes <= pcm.byteLength; i += frameBytes) frames.push(pcm.subarray(i, i + frameBytes));
  return frames;
}

async function main(): Promise<void> {
  const source = toLanguage(values.source ?? 'vi');
  const target = toLanguage(values.target ?? 'ja');
  const outputPath = resolve(values.output ?? 'demo-output/translated.wav');

  let providers: RealtimeProviders;
  let frames: Uint8Array[];
  if (values.live) {
    const [{ createSttProvider }, { createTranslateProvider }, { createTtsProvider }] = await Promise.all([
      import('../src/providers/stt/index.js'),
      import('../src/providers/translate/index.js'),
      import('../src/providers/tts/index.js'),
    ]);
    providers = { stt: createSttProvider(), translate: createTranslateProvider(), tts: createTtsProvider() };
    if (!values.input) throw new Error('--live requires --input <speech.wav>.');
    frames = framesFromPcm(readWavPcm(values.input));
  } else {
    providers = {
      stt: new FakeSttProvider({ script: ['Xin chào, tôi muốn hỏi về thời gian giao hàng.'], lang: source }),
      translate: new FakeTranslateProvider({
        translations: {
          'Xin chào, tôi muốn hỏi về thời gian giao hàng.':
            '[warm] こんにちは。[question] 納品の時期についてお伺いしたいのですが。',
        },
      }),
      tts: new FakeTtsProvider(),
    };
    if (values.input) {
      frames = framesFromPcm(readWavPcm(values.input));
    } else {
      const sample = [...speechFrames(2500), ...silenceFrames(1500)];
      const samplePath = resolve('demo-output/sample-vi.wav');
      mkdirSync(dirname(samplePath), { recursive: true });
      const pcm = Buffer.concat(sample.map((frame) => Buffer.from(frame)));
      writeFileSync(samplePath, Buffer.concat([wavHeader(pcm.byteLength, 16000), pcm]));
      console.log(`Generated sample input: ${samplePath}`);
      frames = framesFromPcm(readWavPcm(samplePath));
    }
  }

  const audio: Buffer[] = [];
  const emit = (event: PipelineEvent): void => {
    switch (event.type) {
      case 'caption.partial':
        break;
      case 'caption.final':
        console.log(`[${event.lang}] heard: ${event.text}`);
        break;
      case 'translation.text':
        console.log(`[${event.lang}] ${event.emotion.padEnd(10)} ${event.text}`);
        break;
      case 'audio':
        audio.push(Buffer.from(event.data));
        break;
      case 'latency':
        console.log(
          `latency ms: stt=${event.sttMs} translate-first=${event.translateFirstMs} tts-first=${event.ttsFirstMs} total=${event.totalMs}`,
        );
        break;
      case 'error':
        console.error(`error ${event.code}: ${event.message}`);
        break;
      default:
        break;
    }
  };

  const orchestrator = new PipelineOrchestrator(
    {
      userId: 'demo-user',
      sessionId: 'demo-session',
      sourceLang: source,
      targetLang: target,
      mode: 'translate',
      persona: { name: 'Aiko' },
      voice: { gender: 'FEMALE', style: 'WARM' },
      speed: 1,
      endpointingMs: 700,
      triggerMode: 'AUTO',
      glossary: [],
    },
    { ...providers, usage: new StubUsageHooks(), emit },
  );

  await orchestrator.start();
  for (const frame of frames) {
    orchestrator.pushAudio(frame);
    if (values.realtime) await new Promise((r) => setTimeout(r, FRAME_MS));
  }
  await orchestrator.end();

  const pcm = Buffer.concat(audio);
  if (pcm.byteLength === 0) {
    console.error('No translated audio was produced.');
    process.exitCode = 1;
    return;
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, Buffer.concat([wavHeader(pcm.byteLength, 24000), pcm]));
  console.log(`Saved ${(pcm.byteLength / 2 / 24000).toFixed(2)} s of ${target} audio to ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

export const INPUT_SAMPLE_RATE = 16000;
export const OUTPUT_SAMPLE_RATE = 24000;
export const FRAME_MS = 20;

function pcm(sampleRate: number, ms: number, amplitude: number, frequency: number): Uint8Array {
  const samples = Math.round((sampleRate * ms) / 1000);
  const out = new Uint8Array(samples * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < samples; i += 1) {
    const value = amplitude === 0 ? 0 : Math.round(Math.sin((2 * Math.PI * frequency * i) / sampleRate) * amplitude * 32767);
    view.setInt16(i * 2, value, true);
  }
  return out;
}

/** 16 kHz PCM16 frames of `ms` milliseconds, split into 20 ms frames. */
export function inputFrames(ms: number, amplitude: number): Uint8Array[] {
  const frames: Uint8Array[] = [];
  for (let elapsed = 0; elapsed < ms; elapsed += FRAME_MS) {
    frames.push(pcm(INPUT_SAMPLE_RATE, FRAME_MS, amplitude, 220));
  }
  return frames;
}

export const speechFrames = (ms: number): Uint8Array[] => inputFrames(ms, 0.3);
export const silenceFrames = (ms: number): Uint8Array[] => inputFrames(ms, 0);

/** 24 kHz PCM16 tone chunk of 20 ms used as fake TTS output. */
export function outputChunk(frequency = 440): Uint8Array {
  return pcm(OUTPUT_SAMPLE_RATE, FRAME_MS, 0.25, frequency);
}

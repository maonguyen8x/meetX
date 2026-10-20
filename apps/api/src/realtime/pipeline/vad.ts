export interface VadOptions {
  /** Minimum RMS (0-1) treated as speech regardless of the noise floor. */
  minThreshold?: number;
  /** Speech must exceed the tracked noise floor by this factor. */
  noiseMultiplier?: number;
  /** Optional model-based classifier returning speech probability (0-1); combined with energy. */
  classifier?: (frame: Int16Array) => number;
}

export function frameRms(frame: Uint8Array): number {
  const samples = Math.floor(frame.byteLength / 2);
  if (samples === 0) return 0;
  const view = new DataView(frame.buffer, frame.byteOffset, samples * 2);
  let sum = 0;
  for (let i = 0; i < samples; i += 1) {
    const value = view.getInt16(i * 2, true) / 32768;
    sum += value * value;
  }
  return Math.sqrt(sum / samples);
}

/** Energy VAD with an adaptive noise floor and an optional model classifier. */
export class EnergyVad {
  private noiseFloor = 0.005;
  private readonly minThreshold: number;
  private readonly noiseMultiplier: number;
  private readonly classifier: ((frame: Int16Array) => number) | undefined;

  constructor(options: VadOptions = {}) {
    this.minThreshold = options.minThreshold ?? 0.012;
    this.noiseMultiplier = options.noiseMultiplier ?? 3;
    this.classifier = options.classifier;
  }

  isSpeech(frame: Uint8Array): boolean {
    const rms = frameRms(frame);
    const threshold = Math.max(this.minThreshold, this.noiseFloor * this.noiseMultiplier);
    let speech = rms >= threshold;
    if (speech && this.classifier) {
      const aligned = new Int16Array(frame.buffer.slice(frame.byteOffset, frame.byteOffset + Math.floor(frame.byteLength / 2) * 2));
      speech = this.classifier(aligned) >= 0.5;
    }
    if (!speech) this.noiseFloor = this.noiseFloor * 0.95 + rms * 0.05;
    return speech;
  }
}

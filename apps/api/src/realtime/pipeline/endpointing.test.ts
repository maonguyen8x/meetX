import { describe, expect, it } from 'vitest';

import { Endpointer, findTrailingTrigger, stripTriggerPhrase } from './endpointing.js';

const PHRASES = ['please interpret', '通訳してください'];

function feed(endpointer: Endpointer, voiced: boolean, frames: number) {
  const signals = [];
  for (let i = 0; i < frames; i += 1) {
    const signal = endpointer.onFrame(voiced);
    if (signal) signals.push(signal);
  }
  return signals;
}

describe('Endpointer', () => {
  it('opens a turn after consecutive voiced frames and ends it after endpointingMs of silence', () => {
    const endpointer = new Endpointer({ endpointingMs: 300, triggerPhrases: PHRASES });
    expect(feed(endpointer, true, 3)).toEqual([{ type: 'speech.start' }]);
    expect(feed(endpointer, false, 14)).toEqual([]);
    expect(feed(endpointer, false, 1)).toEqual([{ type: 'endpoint', reason: 'silence' }]);
    expect(endpointer.isSpeaking).toBe(false);
  });

  it('ignores isolated voiced frames (clicks)', () => {
    const endpointer = new Endpointer({ endpointingMs: 300, triggerPhrases: PHRASES });
    feed(endpointer, true, 2);
    feed(endpointer, false, 1);
    expect(feed(endpointer, true, 2)).toEqual([]);
  });

  it('resets the silence timer when speech resumes', () => {
    const endpointer = new Endpointer({ endpointingMs: 300, triggerPhrases: PHRASES });
    feed(endpointer, true, 3);
    feed(endpointer, false, 10);
    feed(endpointer, true, 1);
    expect(feed(endpointer, false, 14)).toEqual([]);
  });

  it('never endpoints on silence in manual mode but honours the manual override', () => {
    const endpointer = new Endpointer({ endpointingMs: 300, triggerPhrases: PHRASES, silenceEnabled: false });
    feed(endpointer, true, 3);
    expect(feed(endpointer, false, 200)).toEqual([]);
    expect(endpointer.manual()).toEqual({ type: 'endpoint', reason: 'manual' });
  });

  it('ignores manual override when nobody is speaking', () => {
    const endpointer = new Endpointer({ endpointingMs: 300, triggerPhrases: PHRASES });
    expect(endpointer.manual()).toBeNull();
  });

  it('endpoints on a trailing trigger phrase only while speaking', () => {
    const endpointer = new Endpointer({ endpointingMs: 700, triggerPhrases: PHRASES });
    expect(endpointer.onTranscript('hello please interpret')).toBeNull();
    feed(endpointer, true, 3);
    expect(endpointer.onTranscript('hello Please Interpret.')).toEqual({ type: 'endpoint', reason: 'trigger' });
  });
});

describe('trigger phrases', () => {
  it('matches case-insensitively, ignoring trailing punctuation', () => {
    expect(findTrailingTrigger('Okay. Please interpret!', PHRASES)).toBe('please interpret');
    expect(findTrailingTrigger('please interpret this now', PHRASES)).toBeUndefined();
  });

  it('strips the trigger phrase from the transcript', () => {
    expect(stripTriggerPhrase('We ship on Friday, please interpret.', PHRASES)).toBe('We ship on Friday');
    expect(stripTriggerPhrase('納期は金曜です。通訳してください', PHRASES)).toBe('納期は金曜です。');
    expect(stripTriggerPhrase('nothing special', PHRASES)).toBe('nothing special');
  });
});

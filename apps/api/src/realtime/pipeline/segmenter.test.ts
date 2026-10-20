import { describe, expect, it } from 'vitest';

import { SentenceSegmenter } from './segmenter.js';

describe('SentenceSegmenter', () => {
  it('emits a Latin sentence only once the following space is seen', () => {
    const segmenter = new SentenceSegmenter();
    expect(segmenter.push('Hello there.')).toEqual([]);
    expect(segmenter.push(' How are')).toEqual(['Hello there.']);
    expect(segmenter.push(' you? Fine.')).toEqual(['How are you?']);
    expect(segmenter.flush()).toBe('Fine.');
  });

  it('splits Japanese immediately at 。！？', () => {
    const segmenter = new SentenceSegmenter();
    expect(segmenter.push('こんにちは。お元気ですか？はい')).toEqual(['こんにちは。', 'お元気ですか？']);
    expect(segmenter.flush()).toBe('はい');
  });

  it('keeps closing quotes with the sentence', () => {
    const segmenter = new SentenceSegmenter();
    expect(segmenter.push('彼は「行きます。」と言った。')).toEqual(['彼は「行きます。」', 'と言った。']);
  });

  it('does not split decimals or numbers', () => {
    const segmenter = new SentenceSegmenter();
    expect(segmenter.push('The price is 3.5 million. Next')).toEqual(['The price is 3.5 million.']);
  });

  it('splits overly long text at a comma or space', () => {
    const segmenter = new SentenceSegmenter(20);
    const out = segmenter.push('one two three, four five six seven');
    expect(out[0]?.length).toBeLessThanOrEqual(20);
    expect(out[0]).toMatch(/^one two three,/);
  });

  it('flush returns undefined when empty', () => {
    expect(new SentenceSegmenter().flush()).toBeUndefined();
  });
});

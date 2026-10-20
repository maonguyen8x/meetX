import { describe, expect, it } from 'vitest';

import {
  ContextBuilder,
  SUMMARY_TOKEN_BUDGET,
  TURNS_TOKEN_BUDGET,
  estimateTokens,
  truncateToTokens,
} from './context-builder.js';

describe('estimateTokens', () => {
  it('counts CJK characters as one token each and others per four characters', () => {
    expect(estimateTokens('こんにちは')).toBe(5);
    expect(estimateTokens('abcdefgh')).toBe(2);
  });
});

describe('ContextBuilder', () => {
  it('keeps the newest turns within the token budget, oldest first', () => {
    const builder = new ContextBuilder();
    for (let i = 0; i < 40; i += 1) builder.addTurn({ speaker: 'A', text: `turn ${i} ${'x'.repeat(400)}` });
    const { lastTurns } = builder.build();
    const tokens = lastTurns.reduce((sum, t) => sum + estimateTokens(t.speaker) + estimateTokens(t.text), 0);
    expect(tokens).toBeLessThanOrEqual(TURNS_TOKEN_BUDGET);
    expect(lastTurns.at(-1)?.text.startsWith('turn 39')).toBe(true);
    expect(lastTurns.length).toBeLessThan(40);
    expect(lastTurns[0]?.text).toContain('turn');
  });

  it('truncates the summary to its budget', () => {
    const builder = new ContextBuilder();
    builder.setSummary('word '.repeat(5000));
    expect(estimateTokens(builder.build().summary)).toBeLessThanOrEqual(SUMMARY_TOKEN_BUDGET);
    expect(estimateTokens(truncateToTokens('short', 10))).toBeLessThanOrEqual(10);
  });

  it('asks for a summary refresh every 5 turns', () => {
    const builder = new ContextBuilder();
    for (let i = 0; i < 4; i += 1) builder.addTurn({ speaker: 'A', text: 'hi' });
    expect(builder.shouldRefreshSummary()).toBe(false);
    builder.addTurn({ speaker: 'A', text: 'hi' });
    expect(builder.shouldRefreshSummary()).toBe(true);
    builder.setSummary('done');
    expect(builder.shouldRefreshSummary()).toBe(false);
  });

  it('asks for a summary refresh after 90 s when there are new turns', () => {
    let now = 0;
    const builder = new ContextBuilder(() => now);
    now = 91_000;
    expect(builder.shouldRefreshSummary()).toBe(false);
    builder.addTurn({ speaker: 'A', text: 'hi' });
    expect(builder.shouldRefreshSummary()).toBe(true);
  });
});

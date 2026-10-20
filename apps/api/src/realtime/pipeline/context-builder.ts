export const SUMMARY_TOKEN_BUDGET = 600;
export const TURNS_TOKEN_BUDGET = 1200;
const SUMMARY_EVERY_TURNS = 5;
const SUMMARY_EVERY_MS = 90_000;

export interface ContextTurn {
  speaker: string;
  text: string;
}

const CJK = /[\u3040-\u30ff\u3400-\u9fff\uff00-\uffef]/gu;

/** Rough estimate: one token per CJK character, one per four other characters. */
export function estimateTokens(text: string): number {
  const cjk = text.match(CJK)?.length ?? 0;
  return cjk + Math.ceil((text.length - cjk) / 4);
}

export function truncateToTokens(text: string, budget: number): string {
  if (estimateTokens(text) <= budget) return text;
  let end = text.length;
  while (end > 0 && estimateTokens(text.slice(0, end)) > budget) end = Math.floor(end * 0.9);
  return text.slice(0, end).trim();
}

export class ContextBuilder {
  private turns: ContextTurn[] = [];
  private summary = '';
  private turnsSinceSummary = 0;
  private lastSummaryAt: number;

  constructor(private readonly now: () => number = Date.now) {
    this.lastSummaryAt = now();
  }

  addTurn(turn: ContextTurn): void {
    this.turns.push(turn);
    this.turnsSinceSummary += 1;
    if (this.turns.length > 100) this.turns = this.turns.slice(-100);
  }

  setSummary(summary: string): void {
    this.summary = truncateToTokens(summary, SUMMARY_TOKEN_BUDGET);
    this.turnsSinceSummary = 0;
    this.lastSummaryAt = this.now();
  }

  shouldRefreshSummary(): boolean {
    return (
      this.turnsSinceSummary >= SUMMARY_EVERY_TURNS ||
      (this.turnsSinceSummary > 0 && this.now() - this.lastSummaryAt >= SUMMARY_EVERY_MS)
    );
  }

  allTurns(): readonly ContextTurn[] {
    return this.turns;
  }

  /** Newest turns that fit the token budget, oldest first. */
  build(): { summary: string; lastTurns: ContextTurn[] } {
    const selected: ContextTurn[] = [];
    let used = 0;
    for (let i = this.turns.length - 1; i >= 0; i -= 1) {
      const turn = this.turns[i];
      if (!turn) continue;
      const cost = estimateTokens(turn.speaker) + estimateTokens(turn.text);
      if (used + cost > TURNS_TOKEN_BUDGET) break;
      used += cost;
      selected.unshift(turn);
    }
    return { summary: this.summary, lastTurns: selected };
  }
}

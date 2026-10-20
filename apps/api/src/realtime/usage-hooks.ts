export interface UsageRecord {
  userId: string;
  sessionId: string;
  turnId: string;
  sttSeconds: number;
  llmInputTokens: number;
  llmOutputTokens: number;
  ttsCharacters: number;
}

export interface UsageTick {
  creditsUsed: number;
  balance: number;
  minutesLeft: number;
}

/** Billing integration point (real metering arrives in the billing phase). */
export interface UsageHooks {
  record(usage: UsageRecord): Promise<UsageTick>;
}

/** Placeholder until the billing phase: tracks raw quantities only and reports zero credits. */
export class StubUsageHooks implements UsageHooks {
  readonly records: UsageRecord[] = [];

  async record(usage: UsageRecord): Promise<UsageTick> {
    this.records.push(usage);
    return { creditsUsed: 0, balance: 0, minutesLeft: 0 };
  }
}

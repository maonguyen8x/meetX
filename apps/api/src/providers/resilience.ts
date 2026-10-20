import { AppError } from '../utils/errors.js';

export interface ResilienceOptions {
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
}

export const DEFAULT_RESILIENCE: ResilienceOptions = {
  timeoutMs: 10_000,
  maxRetries: 2,
  retryDelayMs: 200,
};

/** Opens after `threshold` consecutive failures and half-opens after `cooldownMs`. */
export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;

  constructor(
    private readonly name: string,
    private readonly threshold = 5,
    private readonly cooldownMs = 30_000,
    private readonly now: () => number = Date.now,
  ) {}

  assertClosed(): void {
    if (this.failures < this.threshold) return;
    if (this.now() - this.openedAt >= this.cooldownMs) return;
    throw new AppError('PROVIDER_UNAVAILABLE', `${this.name} is temporarily unavailable.`, 503);
  }

  recordSuccess(): void {
    this.failures = 0;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.threshold) this.openedAt = this.now();
  }
}

export class ProviderTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms} ms`);
    this.name = 'ProviderTimeoutError';
  }
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof ProviderTimeoutError) return true;
  if (error instanceof AppError) return error.httpStatus >= 500 && error.code !== 'PROVIDER_UNAVAILABLE';
  const status = (error as { status?: number } | null)?.status;
  return status === undefined || status === 429 || status >= 500;
}

export async function withTimeout<T>(
  label: string,
  ms: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ProviderTimeoutError(label, ms));
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Timeout + up to `maxRetries` retries + circuit breaker for a single request/response call. */
export async function callWithResilience<T>(
  label: string,
  breaker: CircuitBreaker,
  run: (signal: AbortSignal) => Promise<T>,
  options: Partial<ResilienceOptions> = {},
): Promise<T> {
  const { timeoutMs, maxRetries, retryDelayMs } = { ...DEFAULT_RESILIENCE, ...options };
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    breaker.assertClosed();
    try {
      const result = await withTimeout(label, timeoutMs, run);
      breaker.recordSuccess();
      return result;
    } catch (error) {
      lastError = error;
      breaker.recordFailure();
      if (attempt === maxRetries || !isRetryable(error)) break;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * 2 ** attempt));
    }
  }
  throw lastError;
}

export class ProviderHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

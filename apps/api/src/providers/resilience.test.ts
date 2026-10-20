import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../utils/errors.js';
import { CircuitBreaker, ProviderHttpError, callWithResilience, withTimeout } from './resilience.js';

const FAST = { retryDelayMs: 1, timeoutMs: 50 };

describe('callWithResilience', () => {
  it('retries retryable failures up to 2 times', async () => {
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ProviderHttpError(503, 'down'))
      .mockRejectedValueOnce(new ProviderHttpError(429, 'slow down'))
      .mockResolvedValue('ok');
    await expect(callWithResilience('t', new CircuitBreaker('t'), run, FAST)).resolves.toBe('ok');
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('gives up after max retries', async () => {
    const run = vi.fn<() => Promise<string>>().mockRejectedValue(new ProviderHttpError(500, 'down'));
    await expect(callWithResilience('t', new CircuitBreaker('t', 99), run, FAST)).rejects.toThrow('down');
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('does not retry client errors', async () => {
    const run = vi.fn<() => Promise<string>>().mockRejectedValue(new ProviderHttpError(401, 'bad key'));
    await expect(callWithResilience('t', new CircuitBreaker('t'), run, FAST)).rejects.toThrow('bad key');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('times out slow calls', async () => {
    const run = () => new Promise<string>(() => undefined);
    await expect(callWithResilience('slow', new CircuitBreaker('t', 99), run, { ...FAST, maxRetries: 0 })).rejects.toThrow(
      'timed out',
    );
  });

  it('aborts the signal on timeout', async () => {
    let aborted = false;
    await expect(
      withTimeout('t', 10, (signal) => {
        signal.addEventListener('abort', () => {
          aborted = true;
        });
        return new Promise<void>(() => undefined);
      }),
    ).rejects.toThrow();
    expect(aborted).toBe(true);
  });
});

describe('CircuitBreaker', () => {
  it('opens after the threshold and half-opens after the cooldown', () => {
    let now = 0;
    const breaker = new CircuitBreaker('x', 2, 1000, () => now);
    breaker.recordFailure();
    expect(() => breaker.assertClosed()).not.toThrow();
    breaker.recordFailure();
    expect(() => breaker.assertClosed()).toThrow(AppError);
    now = 1001;
    expect(() => breaker.assertClosed()).not.toThrow();
    breaker.recordSuccess();
    breaker.recordFailure();
    expect(() => breaker.assertClosed()).not.toThrow();
  });

  it('fails fast without calling the provider while open', async () => {
    const breaker = new CircuitBreaker('x', 1, 60_000);
    breaker.recordFailure();
    const run = vi.fn<() => Promise<string>>();
    await expect(callWithResilience('x', breaker, run, FAST)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(run).not.toHaveBeenCalled();
  });
});

import { ProviderHttpError, callWithResilience } from './resilience.js';
import type { CircuitBreaker, ResilienceOptions } from './resilience.js';

export interface JsonRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Establishes a streaming POST with timeout (until response headers), retries and a circuit breaker.
 * The body stream itself is consumed by the caller.
 */
export async function postStream(
  label: string,
  breaker: CircuitBreaker,
  request: JsonRequest,
  options: Partial<ResilienceOptions> = {},
  signal?: AbortSignal,
): Promise<Response> {
  return callWithResilience(
    label,
    breaker,
    async (timeoutSignal) => {
      const response = await fetch(request.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...request.headers },
        body: JSON.stringify(request.body),
        signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
      });
      if (!response.ok) {
        // Never include the response body: it can echo request content.
        throw new ProviderHttpError(response.status, `${label} responded with HTTP ${response.status}`);
      }
      return response;
    },
    options,
  );
}

/** Yields the `data:` payload of each server-sent event. */
export async function* readSse(response: Response): AsyncGenerator<string> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index = buffer.indexOf('\n\n');
      while (index !== -1) {
        const block = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const data = block
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('\n');
        if (data) yield data;
        index = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function* readBytes(response: Response): AsyncGenerator<Uint8Array> {
  if (!response.body) return;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > 0) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

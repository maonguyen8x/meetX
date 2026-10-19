import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from './app.js';

describe('API health endpoints', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok from the health endpoint', async () => {
    const app = buildApp({
      database: async () => undefined,
      redis: async () => undefined,
    });

    const response = await app.inject({ method: 'GET', url: '/health' });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('reports unavailable dependencies from readiness', async () => {
    const app = buildApp({
      database: async () => {
        throw new Error('database is offline');
      },
      redis: async () => undefined,
    });

    const response = await app.inject({ method: 'GET', url: '/ready' });
    await app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: 'not_ready',
      dependencies: { database: 'unavailable', redis: 'ok' },
    });
  });
});

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

  it('protects the Swagger UI with API authentication', async () => {
    const app = buildApp({
      database: async () => undefined,
      redis: async () => undefined,
    });

    const response = await app.inject({ method: 'GET', url: '/docs' });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
  });

  it('requires authentication on Phase 03 resource routes', async () => {
    const app = buildApp({
      database: async () => undefined,
      redis: async () => undefined,
    });

    const responses = await Promise.all(
      ['/v1/settings', '/v1/meetings', '/v1/glossary'].map((url) =>
        app.inject({ method: 'GET', url }),
      ),
    );
    await app.close();

    expect(responses.map((response) => response.statusCode)).toEqual([401, 401, 401]);
  });
});

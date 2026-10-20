import { describe, expect, it } from 'vitest';

import { redactUrl } from './app.js';

describe('redactUrl', () => {
  it('hides access tokens in WebSocket URLs', () => {
    expect(redactUrl('/v1/ws/session?token=abc.def.ghi&resume=1')).toBe('/v1/ws/session?token=[redacted]&resume=1');
    expect(redactUrl('/v1/ws/session?resume=1&token=secret')).toBe('/v1/ws/session?resume=1&token=[redacted]');
  });

  it('leaves other URLs untouched', () => {
    expect(redactUrl('/v1/meetings?page=2')).toBe('/v1/meetings?page=2');
  });
});

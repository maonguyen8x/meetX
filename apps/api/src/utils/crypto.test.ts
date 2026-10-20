import { describe, expect, it } from 'vitest';

import { decryptSensitiveText, encryptSensitiveText } from './crypto.js';

const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

describe('sensitive text encryption', () => {
  it('round-trips text and produces different ciphertext for repeated plaintext', () => {
    const first = encryptSensitiveText('transcript sample', ENCRYPTION_KEY);
    const second = encryptSensitiveText('transcript sample', ENCRYPTION_KEY);

    expect(first).not.toContain('transcript sample');
    expect(first).not.toBe(second);
    expect(decryptSensitiveText(first, ENCRYPTION_KEY)).toBe('transcript sample');
  });

  it('rejects tampering and invalid encryption keys', () => {
    const encrypted = encryptSensitiveText('private text', ENCRYPTION_KEY);
    const pieces = encrypted.split('.');
    const changed = `${pieces[0]}.${pieces[1]}.${pieces[2]}.${Buffer.from('tampered').toString('base64url')}`;

    expect(() => decryptSensitiveText(changed, ENCRYPTION_KEY)).toThrow(
      'Stored sensitive data could not be decrypted.',
    );
    expect(() => encryptSensitiveText('private text', 'not-a-key')).toThrow(
      'Sensitive data encryption is misconfigured.',
    );
  });
});

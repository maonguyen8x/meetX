import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { env } from '../config/env.js';
import { AppError } from './errors.js';

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function encryptSensitiveText(
  plaintext: string,
  encryptionKey: string | undefined = env.DATA_ENCRYPTION_KEY,
): string {
  const key = parseEncryptionKey(encryptionKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${authTag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptSensitiveText(
  encrypted: string,
  encryptionKey: string | undefined = env.DATA_ENCRYPTION_KEY,
): string {
  const key = parseEncryptionKey(encryptionKey);
  const [version, ivEncoded, tagEncoded, ciphertextEncoded, extra] = encrypted.split('.');
  if (version !== 'v1' || !ivEncoded || !tagEncoded || !ciphertextEncoded || extra !== undefined) {
    throw new AppError('ENCRYPTED_DATA_INVALID', 'Stored sensitive data is invalid.', 500);
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivEncoded, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('ENCRYPTED_DATA_INVALID', 'Stored sensitive data could not be decrypted.', 500);
  }
}

function parseEncryptionKey(encodedKey: string | undefined): Buffer {
  if (!encodedKey) {
    throw new AppError('ENCRYPTION_KEY_MISSING', 'Sensitive data encryption is not configured.', 503);
  }
  if (!/^[A-Za-z0-9+/]{43}=$/.test(encodedKey)) {
    throw new AppError('ENCRYPTION_KEY_INVALID', 'Sensitive data encryption is misconfigured.', 500);
  }
  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32) {
    throw new AppError('ENCRYPTION_KEY_INVALID', 'Sensitive data encryption is misconfigured.', 500);
  }
  return key;
}

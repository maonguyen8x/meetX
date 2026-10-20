import { randomBytes } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { env } from '../../config/env.js';

export interface AvatarStorage {
  save(webp: Buffer): Promise<string>;
  read(filename: string): Promise<Buffer | null>;
  remove(filename: string): Promise<void>;
}

export class LocalAvatarStorage implements AvatarStorage {
  constructor(
    private readonly directory = resolve(
      env.AVATAR_STORAGE_DIR ?? resolve(process.cwd(), 'uploads', 'avatars'),
    ),
  ) {}

  async save(webp: Buffer): Promise<string> {
    await mkdir(this.directory, { recursive: true });
    const filename = `${randomBytes(24).toString('hex')}.webp`;
    await writeFile(resolve(this.directory, filename), webp, { flag: 'wx' });
    return filename;
  }

  async read(filename: string): Promise<Buffer | null> {
    if (!/^[a-f0-9]{48}\.webp$/.test(filename)) return null;
    try {
      return await readFile(resolve(this.directory, filename));
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    }
  }

  async remove(filename: string): Promise<void> {
    if (!/^[a-f0-9]{48}\.webp$/.test(filename)) return;
    try {
      await unlink(resolve(this.directory, filename));
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

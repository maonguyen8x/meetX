import { Prisma } from '@prisma/client';
import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AvatarStorage } from './avatar-storage.js';
import type { SettingsRecord, SettingsRepository } from './settings.repository.js';
import { createSettingsService } from './settings.service.js';

const AVATAR_FILENAME = 'a'.repeat(48) + '.webp';
const settingsRecord: SettingsRecord = {
  userId: '30a9fda1-87cf-4b59-9837-3b36512a38e0',
  personaName: 'AI Interpreter',
  avatarUrl: null,
  voiceGender: 'NEUTRAL',
  voiceStyle: 'PROFESSIONAL',
  speed: new Prisma.Decimal(1),
  volume: new Prisma.Decimal(1),
  duckOriginalPct: 15,
  triggerMode: 'AUTO',
  endpointingMs: 700,
  defaultSourceLang: 'vi',
  defaultTargetLang: 'en',
  saveHistory: true,
  storageMode: 'CLOUD',
};

describe('settings service', () => {
  let currentSettings: SettingsRecord;
  let repository: SettingsRepository;
  let avatarStorage: AvatarStorage;
  let savedAvatar: Buffer | undefined;

  beforeEach(() => {
    currentSettings = settingsRecord;
    savedAvatar = undefined;
    repository = {
      findByUserId: vi.fn(async (userId) =>
        userId === settingsRecord.userId ? currentSettings : null,
      ),
      update: vi.fn(async (_userId, data) => {
        const avatarUrl = typeof data.avatarUrl === 'string' ? data.avatarUrl : currentSettings.avatarUrl;
        const defaultSourceLang =
          typeof data.defaultSourceLang === 'string'
            ? data.defaultSourceLang
            : currentSettings.defaultSourceLang;
        const defaultTargetLang =
          typeof data.defaultTargetLang === 'string'
            ? data.defaultTargetLang
            : currentSettings.defaultTargetLang;
        currentSettings = { ...currentSettings, avatarUrl, defaultSourceLang, defaultTargetLang };
        return currentSettings;
      }),
    };
    avatarStorage = {
      save: vi.fn(async (buffer) => {
        savedAvatar = buffer;
        return AVATAR_FILENAME;
      }),
      read: vi.fn(async () => savedAvatar ?? null),
      remove: vi.fn(async () => undefined),
    };
  });

  it('maps the public default language pair to the persisted settings fields', async () => {
    const service = createSettingsService(repository, avatarStorage);

    const result = await service.update(settingsRecord.userId, {
      defaultPair: { sourceLang: 'ja', targetLang: 'vi' },
    });

    expect(repository.update).toHaveBeenCalledWith(settingsRecord.userId, {
      defaultSourceLang: 'ja',
      defaultTargetLang: 'vi',
    });
    expect(result.defaultPair).toEqual({ sourceLang: 'ja', targetLang: 'vi' });
  });

  it('re-encodes an avatar to WebP and scopes reads to the owning user', async () => {
    const service = createSettingsService(repository, avatarStorage);
    const png = await sharp({
      create: { width: 1, height: 1, channels: 3, background: '#0f766e' },
    })
      .png()
      .toBuffer();

    const result = await service.uploadAvatar(settingsRecord.userId, { buffer: png });

    expect(result.avatarUrl).toBe(`/v1/settings/avatar/${AVATAR_FILENAME}`);
    expect(savedAvatar?.toString('ascii', 0, 4)).toBe('RIFF');
    expect(savedAvatar?.toString('ascii', 8, 12)).toBe('WEBP');
    await expect(service.getAvatar('other-user', AVATAR_FILENAME)).rejects.toThrow('Avatar not found.');
    await expect(service.getAvatar(settingsRecord.userId, AVATAR_FILENAME)).resolves.toEqual(savedAvatar);
  });

  it('rejects files whose bytes do not match an allowed image signature', async () => {
    const service = createSettingsService(repository, avatarStorage);

    await expect(
      service.uploadAvatar(settingsRecord.userId, { buffer: Buffer.from('<script>') }),
    ).rejects.toThrow('Avatar must be a PNG, JPEG, or WebP image.');
    expect(avatarStorage.save).not.toHaveBeenCalled();
  });
});

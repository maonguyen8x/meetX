import sharp from 'sharp';
import type { SettingsPatch, SettingsResponse } from '@meetx/shared/schemas/settings';
import { settingsResponseSchema } from '@meetx/shared/schemas/settings';

import { logger } from '../../utils/logger.js';
import { notFound } from '../../utils/app-errors.js';
import { AppError } from '../../utils/errors.js';
import type { AvatarStorage } from './avatar-storage.js';
import type { SettingsRepository } from './settings.repository.js';

const IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp']);

export interface AvatarImage {
  buffer: Buffer;
}

export function createSettingsService(
  repository: SettingsRepository,
  avatarStorage: AvatarStorage,
) {
  async function get(userId: string): Promise<SettingsResponse> {
    const settings = await repository.findByUserId(userId);
    if (!settings) throw notFound('Interpreter settings not found.');
    return toSettingsResponse(settings);
  }

  async function update(userId: string, input: SettingsPatch): Promise<SettingsResponse> {
    const current = await repository.findByUserId(userId);
    if (!current) throw notFound('Interpreter settings not found.');
    const { defaultPair, ...fields } = input;
    const settings = await repository.update(userId, {
      ...fields,
      ...(defaultPair
        ? {
            defaultSourceLang: defaultPair.sourceLang,
            defaultTargetLang: defaultPair.targetLang,
          }
        : {}),
    });
    return toSettingsResponse(settings);
  }

  async function uploadAvatar(userId: string, image: AvatarImage): Promise<SettingsResponse> {
    const webp = await reencodeAvatar(image.buffer);
    const previous = await repository.findByUserId(userId);
    if (!previous) throw notFound('Interpreter settings not found.');

    const filename = await avatarStorage.save(webp);
    const avatarUrl = `/v1/settings/avatar/${filename}`;
    let updated;
    try {
      updated = await repository.update(userId, { avatarUrl });
    } catch (error) {
      try {
        await avatarStorage.remove(filename);
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'Avatar update and cleanup both failed.');
      }
      throw error;
    }
    if (previous.avatarUrl) {
      const previousFilename = filenameFromAvatarUrl(previous.avatarUrl);
      if (previousFilename) {
        try {
          await avatarStorage.remove(previousFilename);
        } catch (error) {
          logger.error({ err: error, userId }, 'Failed to remove replaced avatar');
        }
      }
    }
    return toSettingsResponse(updated);
  }

  async function getAvatar(userId: string, filename: string): Promise<Buffer> {
    const settings = await repository.findByUserId(userId);
    if (!settings || settings.avatarUrl !== `/v1/settings/avatar/${filename}`) {
      throw notFound('Avatar not found.');
    }
    const avatar = await avatarStorage.read(filename);
    if (!avatar) throw notFound('Avatar not found.');
    return avatar;
  }

  return { get, update, uploadAvatar, getAvatar };
}

function toSettingsResponse(
  settings: Awaited<ReturnType<SettingsRepository['findByUserId']>>,
): SettingsResponse {
  if (!settings) throw notFound('Interpreter settings not found.');
  return settingsResponseSchema.parse({
    personaName: settings.personaName,
    avatarUrl: settings.avatarUrl,
    voiceGender: settings.voiceGender,
    voiceStyle: settings.voiceStyle,
    speed: Number(settings.speed),
    volume: Number(settings.volume),
    duckOriginalPct: settings.duckOriginalPct,
    triggerMode: settings.triggerMode,
    endpointingMs: settings.endpointingMs,
    defaultPair: {
      sourceLang: settings.defaultSourceLang,
      targetLang: settings.defaultTargetLang,
    },
    saveHistory: settings.saveHistory,
    storageMode: settings.storageMode,
  });
}

async function reencodeAvatar(buffer: Buffer): Promise<Buffer> {
  const detectedFormat = detectImageFormat(buffer);
  if (!detectedFormat) {
    throw new AppError('INVALID_IMAGE_TYPE', 'Avatar must be a PNG, JPEG, or WebP image.', 415);
  }
  try {
    const image = sharp(buffer, { limitInputPixels: 40_000_000, failOn: 'error' });
    const metadata = await image.metadata();
    if (!metadata.format || !IMAGE_FORMATS.has(metadata.format) || metadata.format !== detectedFormat) {
      throw new AppError('INVALID_IMAGE_TYPE', 'Avatar image content is invalid.', 415);
    }
    return await image
      .rotate()
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('INVALID_IMAGE', 'Avatar image could not be decoded.', 400);
  }
}

function detectImageFormat(buffer: Buffer): string | null {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

function filenameFromAvatarUrl(avatarUrl: string): string | null {
  const match = /^\/v1\/settings\/avatar\/([a-f0-9]{48}\.webp)$/.exec(avatarUrl);
  return match?.[1] ?? null;
}

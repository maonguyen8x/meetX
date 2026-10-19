import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv({ path: resolve(process.cwd(), '../../.env') });

const optionalString = z.string().optional();

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  DATA_ENCRYPTION_KEY: optionalString,
  SENTRY_DSN: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  STT_PROVIDER: z.string().default('deepgram'),
  STT_API_KEY: optionalString,
  STT_MODEL: optionalString,
  TRANSLATE_PROVIDER: z.string().default('anthropic'),
  TRANSLATE_API_KEY: optionalString,
  TRANSLATE_MODEL: optionalString,
  TTS_PROVIDER: z.string().default('elevenlabs'),
  TTS_API_KEY: optionalString,
  TTS_MODEL: optionalString,
  TTS_VOICE_MALE: optionalString,
  TTS_VOICE_FEMALE: optionalString,
  MEETING_BOT_PROVIDER: z.string().default('recall'),
  MEETING_BOT_API_KEY: optionalString,
  MEETING_BOT_REGION: optionalString,
  LIVEKIT_URL: optionalString,
  LIVEKIT_API_KEY: optionalString,
  LIVEKIT_API_SECRET: optionalString,
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  S3_ENDPOINT: optionalString,
  S3_BUCKET: z.string().default('meetx'),
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
  S3_REGION: z.string().default('us-east-1'),
  EMBEDDING_PROVIDER: optionalString,
  EMBEDDING_API_KEY: optionalString,
  EMBEDDING_MODEL: optionalString,
  EMBEDDING_DIM: z.coerce.number().int().positive().default(1024),
  ANSWER_MODEL: optionalString,
  ANSWER_REASONING_MODEL: optionalString,
  DEEP_MAX_STEPS: z.coerce.number().int().positive().default(4),
  WEB_SEARCH_PROVIDER: z.string().default('tavily'),
  WEB_SEARCH_API_KEY: optionalString,
  EMAIL_PROVIDER: z.string().default('console'),
  EMAIL_API_KEY: optionalString,
  EMAIL_FROM: z.string().default('Interpreter AI <noreply@example.com>'),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SEED_SUPER_ADMIN_EMAIL: z.string().email().default('admin@example.com'),
  SEED_SUPER_ADMIN_PASSWORD: optionalString,
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  throw new Error(
    `Invalid environment configuration: ${JSON.stringify(parsedEnvironment.error.flatten().fieldErrors)}`,
  );
}

export const env = parsedEnvironment.data;

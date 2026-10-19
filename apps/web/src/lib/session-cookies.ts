import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

export const ACCESS_COOKIE = 'mx_at';
export const REFRESH_COOKIE = 'mx_rt';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const secure = process.env.NODE_ENV === 'production';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

export function setSessionCookies(response: NextResponse, tokens: TokenPair): void {
  const base = { httpOnly: true, sameSite: 'lax', secure, path: '/' } as const;
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, { ...base, maxAge: tokens.expiresIn });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, { ...base, maxAge: 30 * 24 * 60 * 60 });
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
}

// Refresh tokens rotate, so concurrent requests must share one refresh call per token.
const inflight = new Map<string, Promise<TokenPair | null>>();

export function refreshTokens(refreshToken: string): Promise<TokenPair | null> {
  const existing = inflight.get(refreshToken);
  if (existing) return existing;
  const attempt = fetch(apiUrl('/v1/auth/refresh'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  })
    .then(async (response) => (response.ok ? ((await response.json()) as TokenPair) : null))
    .catch(() => null)
    .finally(() => {
      setTimeout(() => inflight.delete(refreshToken), 10_000);
    });
  inflight.set(refreshToken, attempt);
  return attempt;
}

export async function readSessionCookies(): Promise<{ access?: string; refresh?: string }> {
  const store = await cookies();
  return { access: store.get(ACCESS_COOKIE)?.value, refresh: store.get(REFRESH_COOKIE)?.value };
}

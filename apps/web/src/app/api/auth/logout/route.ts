import { NextResponse } from 'next/server';

import {
  apiUrl,
  clearSessionCookies,
  readSessionCookies,
  refreshTokens,
} from '@/lib/session-cookies';

export async function POST() {
  const cookies = await readSessionCookies();
  let { access, refresh } = cookies;
  // An expired access token must not leave the server-side session alive.
  if (!access && refresh) {
    const renewed = await refreshTokens(refresh);
    access = renewed?.accessToken;
    refresh = renewed?.refreshToken;
  }
  if (access && refresh) {
    await fetch(apiUrl('/v1/auth/logout'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${access}` },
      body: JSON.stringify({ refreshToken: refresh }),
      cache: 'no-store',
    }).catch(() => null);
  }
  const response = NextResponse.json({ status: 'ok' });
  clearSessionCookies(response);
  return response;
}

import { NextResponse } from 'next/server';

import { apiUrl, setSessionCookies } from '@/lib/session-cookies';
import type { TokenPair } from '@/lib/session-cookies';

export async function POST(request: Request) {
  const body = await request.text();
  const upstream = await fetch(apiUrl('/v1/auth/login'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': request.headers.get('user-agent') ?? '',
      'x-forwarded-for': request.headers.get('x-forwarded-for') ?? '',
    },
    body,
    cache: 'no-store',
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json(
      { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Service unavailable.' } },
      { status: 502 },
    );
  }
  const payload = (await upstream.json().catch(() => ({}))) as TokenPair & { user?: unknown };
  if (!upstream.ok) return NextResponse.json(payload, { status: upstream.status });

  const response = NextResponse.json({ user: payload.user });
  setSessionCookies(response, payload);
  return response;
}

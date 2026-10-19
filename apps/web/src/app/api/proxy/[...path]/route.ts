import { NextResponse } from 'next/server';

import {
  apiUrl,
  clearSessionCookies,
  readSessionCookies,
  refreshTokens,
  setSessionCookies,
} from '@/lib/session-cookies';
import type { TokenPair } from '@/lib/session-cookies';

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

const BLOCKED_PREFIXES = ['v1/auth/login', 'v1/auth/refresh', 'v1/auth/logout'];

async function forward(request: Request, path: string, token: string | undefined, body: string | undefined) {
  const url = new URL(request.url);
  const headers: Record<string, string> = {
    'user-agent': request.headers.get('user-agent') ?? '',
    'x-forwarded-for': request.headers.get('x-forwarded-for') ?? '',
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(apiUrl(`/${path}${url.search}`), {
    method: request.method,
    headers,
    body,
    cache: 'no-store',
  });
}

async function handle(request: Request, context: RouteContext) {
  const { path: segments } = await context.params;
  const path = segments.join('/');
  if (!path.startsWith('v1/') || BLOCKED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Not found.' } }, { status: 404 });
  }

  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
  const { access, refresh } = await readSessionCookies();

  let renewed: TokenPair | null = null;
  let upstream: Response;
  try {
    upstream = await forward(request, path, access, body);
    if (upstream.status === 401 && refresh) {
      renewed = await refreshTokens(refresh);
      if (renewed) upstream = await forward(request, path, renewed.accessToken, body);
    }
  } catch {
    return NextResponse.json(
      { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Service unavailable.' } },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  const response = new NextResponse(upstream.status === 204 ? null : text, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
  if (renewed) setSessionCookies(response, renewed);
  else if (upstream.status === 401 && refresh) clearSessionCookies(response);
  return response;
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };

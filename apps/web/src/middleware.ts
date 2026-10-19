import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);
const PROTECTED = /^\/(vi|en|ja)\/(dashboard|admin|org|change-password)(\/|$)/;

// Cheap gate only: the API still authorizes every request.
export default function middleware(request: NextRequest) {
  const match = PROTECTED.exec(request.nextUrl.pathname);
  if (match && !request.cookies.has('mx_rt')) {
    return NextResponse.redirect(new URL(`/${match[1]}/login`, request.url));
  }
  return intlMiddleware(request);
}

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};

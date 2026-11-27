import { NextResponse, type NextRequest } from 'next/server';
import { contentSecurityPolicy, createNonce } from './lib/csp';

/** Same name as SESSION_COOKIE in lib/session.ts (that module is server-only). */
const SESSION_COOKIE = 'mindbridge_session';
const PUBLIC_PATHS = ['/login'];

/**
 * Runs before every page:
 * - sets a nonce-based Content-Security-Policy (Next.js reads the nonce from the
 *   request header and stamps its own scripts with it);
 * - sends visitors without a session to the login page, remembering where they
 *   were going. Only presence is checked: the API validates the key on every
 *   request, and pages redirect on their own if credentials are missing.
 */
export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = contentSecurityPolicy(nonce, { development: process.env.NODE_ENV === 'development' });
  const { pathname, search } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const configured = Boolean(process.env.MINDBRIDGE_API_KEY?.trim());
  if (!isPublic && !configured && !request.cookies.has(SESSION_COOKIE)) {
    const login = new URL('/login', request.url);
    const target = `${pathname}${search}`;
    if (target !== '/') login.searchParams.set('next', target);
    const redirect = NextResponse.redirect(login);
    redirect.headers.set('content-security-policy', csp);
    return redirect;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages, not static assets; prefetches render no HTML, so they skip the nonce.
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

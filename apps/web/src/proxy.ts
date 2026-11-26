import { NextResponse, type NextRequest } from 'next/server';

/** Same name as SESSION_COOKIE in lib/session.ts (that module is server-only). */
const SESSION_COOKIE = 'mindbridge_session';

/**
 * Sends visitors without a session to the login page, remembering where they
 * were going. Only checks that a session exists: the API validates the key on
 * every request. With MINDBRIDGE_API_KEY configured there is always a session.
 */
export function proxy(request: NextRequest) {
  const configured = Boolean(process.env.MINDBRIDGE_API_KEY?.trim());
  if (configured || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const login = new URL('/login', request.url);
  const target = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (target !== '/') login.searchParams.set('next', target);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except the login page, Next.js assets and the favicon.
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico).*)'],
};

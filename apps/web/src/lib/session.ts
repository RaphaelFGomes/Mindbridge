import 'server-only';
import { cookies } from 'next/headers';
import { resolveCredentials, type Credentials } from './credentials';

/** Name shared with proxy.ts (which only checks presence). */
export const SESSION_COOKIE = 'mindbridge_session';

const ONE_WEEK = 60 * 60 * 24 * 7;

/**
 * The API key lives only in this cookie: httpOnly (no JavaScript access),
 * SameSite=Strict (not sent on cross-site requests) and Secure in production.
 * Every API call happens on the server; the browser never handles the key.
 */
export async function startSession(apiKey: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, apiKey, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_WEEK,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in key, or MINDBRIDGE_API_KEY when configured (local use only). */
export async function credentials(): Promise<Credentials> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  return resolveCredentials(cookie, process.env.MINDBRIDGE_API_KEY);
}

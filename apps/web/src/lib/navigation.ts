/**
 * Where to go after signing in. Only same-origin paths are allowed, so a
 * crafted link (?next=https://evil.example) cannot turn login into an open redirect.
 */
export function safeNextPath(next: unknown, fallback = '/memories'): string {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return fallback;
  if (next.includes('\\') || /\p{Cc}/u.test(next)) return fallback;
  return next;
}

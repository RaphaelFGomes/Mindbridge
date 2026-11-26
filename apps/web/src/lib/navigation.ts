/**
 * Where to go after signing in. Only same-origin paths are allowed, so a
 * crafted link (?next=https://evil.example) cannot turn login into an open redirect.
 */
export function safeNextPath(next: unknown, fallback = '/memories'): string {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return fallback;
  let hasControlCharacter = false;
  for (let index = 0; index < next.length; index++) {
    if (next.charCodeAt(index) < 0x20) hasControlCharacter = true;
  }
  if (next.includes('\\') || hasControlCharacter) return fallback;
  return next;
}

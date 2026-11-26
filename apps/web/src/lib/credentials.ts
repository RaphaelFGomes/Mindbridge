/** Where the API key for this request comes from. */
export type Credentials = { key: string; source: 'cookie' | 'env' } | null;

/**
 * An explicit sign-in (the session cookie) wins; otherwise MINDBRIDGE_API_KEY,
 * a local convenience that skips the login page. Blank values count as unset.
 */
export function resolveCredentials(
  cookie: string | undefined,
  configured: string | undefined,
): Credentials {
  if (cookie) return { key: cookie, source: 'cookie' };
  const key = configured?.trim();
  return key ? { key, source: 'env' } : null;
}

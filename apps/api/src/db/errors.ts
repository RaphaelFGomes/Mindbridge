const UNIQUE_VIOLATION = '23505';
// EPERM: the connection was blocked locally (firewall, sandbox).
const CONNECTION_FAILURES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'EPERM',
]);

/** Walks the error and its `cause` chain, looking for a `code` property. */
function hasCode(error: unknown, matches: (code: unknown) => boolean): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if ('code' in current && matches(current.code)) return true;
    current = current.cause;
  }
  return false;
}

/** True when the error (or any error in its `cause` chain) is a Postgres unique violation. */
export function isUniqueViolation(error: unknown): boolean {
  return hasCode(error, (code) => code === UNIQUE_VIOLATION);
}

/** True when the database could not be reached at all (down, wrong host or port). */
export function isConnectionFailure(error: unknown): boolean {
  return hasCode(error, (code) => typeof code === 'string' && CONNECTION_FAILURES.has(code));
}

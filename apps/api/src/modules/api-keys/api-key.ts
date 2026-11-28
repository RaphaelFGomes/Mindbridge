import { createHash, randomBytes } from 'node:crypto';
import { slugSchema } from '../../shared/slug.js';

/** Fixed prefix so secret scanners (gitleaks, GitHub) can recognise leaked keys. */
export const API_KEY_PREFIX = 'mb_';

// "mb_" + 32 random bytes in base64url (43 chars, no padding).
const API_KEY_PATTERN = /^mb_[A-Za-z0-9_-]{43}$/;
const DISPLAY_PREFIX_LENGTH = 12;

/** e.g. "claude-code", "copilot-laptop". */
export const apiKeyNameSchema = slugSchema(64);

export function generateApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export function isWellFormedApiKey(value: string): boolean {
  return API_KEY_PATTERN.test(value);
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** The part of a key that is safe to show in listings and logs. */
export function displayPrefix(key: string): string {
  return key.slice(0, DISPLAY_PREFIX_LENGTH);
}

/** Extracts the token from `Authorization: Bearer <token>` (RFC 6750), or null. */
export function parseBearerToken(header: string | undefined): string | null {
  if (header === undefined) return null;
  const match = /^Bearer +(\S+) *$/i.exec(header);
  return match?.[1] ?? null;
}

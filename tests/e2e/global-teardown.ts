import { revokeKey } from './support/keys.js';

export default function globalTeardown() {
  const name = process.env.E2E_API_KEY_NAME;
  if (name) revokeKey(name);
}

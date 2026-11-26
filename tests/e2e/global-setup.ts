import { createKey } from './support/keys.js';

/** One key for the run (E2E_API_KEY): used to sign in once and to seed data through the API. */
export default function globalSetup() {
  if (process.env.E2E_API_KEY) return;
  const name = `e2e-${Date.now()}`;
  process.env.E2E_API_KEY = createKey(name);
  process.env.E2E_API_KEY_NAME = name;
}

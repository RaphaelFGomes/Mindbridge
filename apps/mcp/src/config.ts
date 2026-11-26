import { z } from 'zod';

const KEY_HINT =
  'must be a Mindbridge API key (mb_…); create one with `pnpm keys:create --name <assistant>`';

const envSchema = z.object({
  MINDBRIDGE_API_URL: z
    .url({ protocol: /^https?$/, error: 'must be an http(s) URL' })
    .default('http://127.0.0.1:4000'),
  // Same hint whether the key is missing (first setup) or malformed.
  MINDBRIDGE_API_KEY: z
    .string({ error: KEY_HINT })
    .regex(/^mb_[A-Za-z0-9_-]{43}$/, { error: KEY_HINT }),
  /** Overrides the project detected from `git remote get-url origin`. */
  MINDBRIDGE_PROJECT: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
});

export type Config = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  override name = 'ConfigError';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new ConfigError(
      `Invalid Mindbridge MCP configuration:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** Same rule as the API: lowercase host + path segments. */
const PROJECT_KEY = /^[a-z0-9][a-z0-9.-]*(?:\/[a-z0-9._-]+)+$/;

/**
 * Turns a git remote URL into a Mindbridge project key, so SSH and HTTPS clones
 * of the same repository share memories: no scheme, credentials, port, `.git`
 * suffix or casing differences. Returns null for remotes that have no
 * host/path shape (local paths, garbage).
 */
export function normalizeGitRemote(remote: string): string | null {
  const value = remote.trim();
  let host: string;
  let path: string;

  // scp-like syntax: [user@]host:path (no scheme)
  const scp = /^(?:[^@/\s]+@)?([^:/\s]+):(?!\/\/)(.+)$/.exec(value);
  if (scp && !value.includes('://')) {
    // Stryker disable next-line StringLiteral: unreachable — both groups always match.
    host = scp[1] ?? '';
    // Stryker disable next-line StringLiteral: unreachable — both groups always match.
    path = scp[2] ?? '';
  } else {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    host = url.hostname;
    path = decodeURIComponent(url.pathname);
  }

  const segments = path
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
    .split('/')
    .filter(Boolean);
  const key = [host, ...segments].join('/').toLowerCase();
  return PROJECT_KEY.test(key) ? key : null;
}

/** The project key of the git repository at `cwd`, or null outside a repo / without an origin. */
export async function detectProject(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await run('git', ['remote', 'get-url', 'origin'], { cwd, timeout: 3000 });
    return normalizeGitRemote(stdout);
  } catch {
    return null;
  }
}

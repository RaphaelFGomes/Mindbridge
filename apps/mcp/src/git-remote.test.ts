import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { detectProject, normalizeGitRemote } from './git-remote.js';

describe('normalizeGitRemote', () => {
  it.each([
    ['git@github.com:Acme/Widgets.git', 'github.com/acme/widgets'],
    ['https://github.com/Acme/Widgets.git', 'github.com/acme/widgets'],
    ['https://github.com/acme/widgets', 'github.com/acme/widgets'],
    ['https://github.com/acme/widgets/', 'github.com/acme/widgets'],
    ['ssh://git@github.com:22/acme/widgets.git', 'github.com/acme/widgets'],
    [
      'https://user:s3cret@gitlab.example.org/group/sub/repo.git',
      'gitlab.example.org/group/sub/repo',
    ],
    ['https://dev.azure.com/acme/widgets/_git/api', 'dev.azure.com/acme/widgets/_git/api'],
    ['git@bitbucket.org:acme/my_repo.js.git', 'bitbucket.org/acme/my_repo.js'],
    ['  git@github.com:acme/widgets.git\n', 'github.com/acme/widgets'],
    // Each case pins down part of the parsing (optional user, trailing slashes, .git suffix only).
    ['github.com:acme/widgets.git', 'github.com/acme/widgets'],
    ['https://github.com/acme/widgets.git//', 'github.com/acme/widgets'],
    ['git@github.com:acme/acme.github.io.git', 'github.com/acme/acme.github.io'],
  ])('%s → %s', (remote, key) => {
    expect(normalizeGitRemote(remote)).toBe(key);
  });

  it('never leaks credentials from the remote URL', () => {
    expect(
      normalizeGitRemote('https://x-access-token:ghp_abc@github.com/acme/widgets'),
    ).not.toMatch(/token|ghp_/);
  });

  it.each([
    '',
    'not a remote',
    '/home/me/repos/widgets',
    'file:///srv/git/widgets.git',
    'https://github.com/',
    'some/path:repo',
    'https://github.com/acme/my%20repo',
    'git@github.com:acme/widgets\nrm -rf',
  ])('returns null for %j', (remote) => {
    expect(normalizeGitRemote(remote)).toBeNull();
  });
});

describe('detectProject', () => {
  const root = mkdtempSync(join(tmpdir(), 'mindbridge-git-'));
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', args, { cwd, stdio: 'ignore' });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('derives the project from the origin remote', async () => {
    const repo = mkdtempSync(join(root, 'repo-'));
    git(repo, 'init', '--quiet');
    git(repo, 'remote', 'add', 'origin', 'git@github.com:Acme/Widgets.git');

    await expect(detectProject(repo)).resolves.toBe('github.com/acme/widgets');
  });

  it('returns null in a repository without an origin remote', async () => {
    const repo = mkdtempSync(join(root, 'no-origin-'));
    git(repo, 'init', '--quiet');

    await expect(detectProject(repo)).resolves.toBeNull();
  });

  it('returns null outside a git repository', async () => {
    await expect(detectProject(mkdtempSync(join(root, 'plain-')))).resolves.toBeNull();
  });
});

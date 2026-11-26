import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect, expectAccessible, runKey, test } from '../fixtures.js';
import { createKey, revokeKey } from '../support/keys.js';

const signIn = async (page: Page, key: string) => {
  await page.getByLabel('API key').fill(key);
  await page.getByRole('button', { name: 'Sign in' }).click();
};

test.describe('Signing in', () => {
  test('the login page is accessible', async ({ page }) => {
    await page.goto('/login');
    await expectAccessible(page);
  });

  test('sends visitors to the login page and back to where they were going', async ({ page }) => {
    await page.goto('/memories?type=user');
    await expect(page).toHaveURL(/\/login\?next=/);

    await signIn(page, runKey());

    await expect(page).toHaveURL(/\/memories\?type=user$/);
  });

  test('keeps the key in an httpOnly, SameSite=Strict cookie out of JavaScript reach', async ({
    page,
    context,
  }) => {
    await page.goto('/login');
    await signIn(page, runKey());
    await expect(page.getByRole('heading', { level: 1, name: 'Memories' })).toBeVisible();

    const session = (await context.cookies()).find(
      (cookie) => cookie.name === 'mindbridge_session',
    );
    expect(session).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/' });
    expect(await page.evaluate(() => document.cookie)).not.toContain('mindbridge_session');
  });

  test.describe('rejects', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
    });

    test('a value that is not an API key', async ({ page }) => {
      await signIn(page, 'not-a-key');
      await expect(page.getByText('does not look like a Mindbridge API key')).toBeVisible();
      await expect(page.getByLabel('API key')).toHaveAttribute('aria-invalid', 'true');
      await expect(page).toHaveURL(/\/login/);
    });

    test('a well-formed key the API does not know', async ({ page }) => {
      await signIn(page, `mb_${'A'.repeat(43)}`);
      await expect(page.getByText('not valid or has been revoked')).toBeVisible();
    });
  });

  test('never redirects off-site after signing in', async ({ page, baseURL }) => {
    await page.goto('/login?next=https://evil.example/phish');
    await signIn(page, runKey());
    await expect(page).toHaveURL(`${baseURL ?? ''}/memories`);
  });

  test('signing out ends the session', async ({ page }) => {
    await page.goto('/login');
    await signIn(page, runKey());
    await page.getByRole('button', { name: 'Sign out' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/memories');
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test('a revoked key ends the session with an explanation', async ({ page }) => {
    const name = `e2e-revoked-${randomUUID()}`;
    await page.goto('/login');
    await signIn(page, createKey(name));
    await expect(page.getByRole('heading', { level: 1, name: 'Memories' })).toBeVisible();

    revokeKey(name);
    await page.reload();

    await expect(page).toHaveURL(/\/login\?expired=1$/);
    await expect(page.getByRole('status')).toHaveText(/session ended/);
  });
});

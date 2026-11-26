import { expect, test as setup } from '@playwright/test';
import { runKey } from '../fixtures.js';
import { sessionFile } from '../support/env.js';

setup('sign in through the login page', async ({ page }) => {
  await page.goto('/memories');
  await expect(page).toHaveURL(/\/login\?next=%2Fmemories$/);

  await page.getByLabel('API key').fill(runKey());
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Memories' })).toBeVisible();
  await page.context().storageState({ path: sessionFile });
});

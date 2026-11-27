import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { expect, test, type Seeder } from '../fixtures.js';

/**
 * Screenshots of every page, desktop and mobile, rendered in the official
 * Playwright container. Names are fixed (each test has its own project);
 * dates and project keys change every run, so they are masked. Project keys
 * render in a monospace font with a fixed-length UUID, so their masks keep the
 * same size from run to run.
 */
const changing = (page: Page, project: string): Locator[] => [
  page.getByText(/ UTC$/),
  page.getByText(project, { exact: true }),
  page.getByLabel('Project', { exact: true }),
];

async function seedExamples(seed: Seeder) {
  await seed.memory({
    type: 'user',
    name: 'prefers-concise-answers',
    description: 'Keep answers short and skip the preamble',
    content: 'The user reads on a phone between meetings.',
  });
  await seed.memory({ type: 'feedback', name: 'prefers-pnpm', description: 'Use pnpm, never npm' });
  await seed.memory({
    type: 'project',
    name: 'deploy-freeze',
    description: 'No deploys until the 2nd',
    content: 'Release freeze agreed with the platform team.',
  });
  await seed.memory({
    type: 'reference',
    name: 'runbook',
    description: 'Where the runbook lives',
    content: 'See the team wiki, section Operations.',
  });
}

test.describe('Visual', () => {
  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('login page', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
      await expect(page).toHaveScreenshot('login.png', { fullPage: true });
    });
  });

  test('memories list', async ({ page, project, seed }) => {
    await seedExamples(seed);
    await page.goto(`/memories?project=${encodeURIComponent(project)}&global=exclude`);
    await expect(page.getByRole('list', { name: 'Memories' }).getByRole('listitem')).toHaveCount(4);
    await expect(page).toHaveScreenshot('memories-list.png', {
      fullPage: true,
      mask: changing(page, project),
    });
  });

  test('empty list', async ({ page, project }) => {
    await page.goto(`/memories?project=${encodeURIComponent(project)}&global=exclude`);
    await expect(page.getByText('No memories here yet')).toBeVisible();
    await expect(page).toHaveScreenshot('memories-empty.png', {
      fullPage: true,
      mask: changing(page, project),
    });
  });

  test('new memory form with validation errors', async ({ page }) => {
    await page.goto('/memories/new');
    await page.getByRole('button', { name: 'Create memory' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await expect(page).toHaveScreenshot('memory-form-errors.png', { fullPage: true });
  });

  test('memory page', async ({ page, project, seed }) => {
    const memory = await seed.memory({
      type: 'project',
      name: 'deploy-freeze',
      description: 'No deploys until the 2nd',
      content:
        '## Release freeze\n\n- Agreed with the platform team\n- Hotfixes need two approvals',
    });
    await page.goto(`/memories/${memory.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'deploy-freeze' })).toBeVisible();
    await expect(page).toHaveScreenshot('memory-page.png', {
      fullPage: true,
      mask: changing(page, project),
    });
  });

  test('delete confirmation dialog', async ({ page, seed }) => {
    const memory = await seed.memory({ name: 'prefers-pnpm', description: 'Use pnpm, never npm' });
    await page.goto(`/memories/${memory.id}`);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    // The dialog alone: masks are painted above everything, so masking the page
    // behind the overlay would hide the dialog's own title.
    await expect(dialog).toHaveScreenshot('delete-dialog.png');
  });

  test('not-found page', async ({ page }) => {
    await page.goto(`/memories/${randomUUID()}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Not found' })).toBeVisible();
    await expect(page).toHaveScreenshot('not-found.png', { fullPage: true });
  });
});

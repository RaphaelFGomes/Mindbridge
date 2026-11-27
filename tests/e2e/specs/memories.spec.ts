import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect, memoryIdFrom, test } from '../fixtures.js';

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });

test.describe('Memories', () => {
  test('keeps every field after a validation error and focuses the invalid one', async ({
    page,
    project,
  }) => {
    // Regression: React's form reset used to snap the type and scope back to their defaults.
    await page.goto('/memories/new');
    await field(page, 'Type').selectOption('reference');
    await field(page, 'Name').fill('Runbook Location');
    await field(page, 'Description').fill('Where the runbook lives');
    await field(page, 'Content').fill('See the team wiki, section Operations.');
    await page.getByRole('radio', { name: 'One project' }).check();
    await field(page, 'Project').fill(project);

    await page.getByRole('button', { name: 'Create memory' }).click();

    await expect(page.getByRole('main').getByRole('alert')).toHaveText(/fix the highlighted field/);
    await expect(field(page, 'Name')).toBeFocused();
    await expect(field(page, 'Name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('must be kebab-case')).toBeVisible();
    await expect(field(page, 'Type')).toHaveValue('reference');
    await expect(page.getByRole('radio', { name: 'One project' })).toBeChecked();
    await expect(field(page, 'Project')).toHaveValue(project);
    await expect(field(page, 'Description')).toHaveValue('Where the runbook lives');
    await expect(field(page, 'Content')).toHaveValue('See the team wiki, section Operations.');
  });

  test('creates a project memory and finds it with the project filter', async ({
    page,
    project,
    seed,
  }) => {
    const name = `runbook-${randomUUID()}`;
    await page.goto(`/memories/new?project=${encodeURIComponent(project)}`);
    await expect(page.getByRole('radio', { name: 'One project' })).toBeChecked();
    await field(page, 'Type').selectOption('reference');
    await field(page, 'Name').fill(name);
    await field(page, 'Description').fill('Where the runbook lives');
    await field(page, 'Content').fill('See the team wiki, section Operations.');
    await page.getByRole('button', { name: 'Create memory' }).click();

    await expect(page.getByRole('status')).toHaveText('Memory saved.');
    seed.track(memoryIdFrom(page));
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(page.getByText(project)).toBeVisible();

    await page.goto('/memories');
    await field(page, 'Project').fill(project);
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByRole('link', { name })).toBeVisible();
  });

  test('points out a duplicate name on the name field', async ({ page, project, seed }) => {
    const existing = await seed.memory();
    await page.goto(`/memories/new?project=${encodeURIComponent(project)}`);
    await field(page, 'Name').fill(existing.name);
    await field(page, 'Description').fill('Another fact');
    await field(page, 'Content').fill('Another fact, same name.');
    await page.getByRole('button', { name: 'Create memory' }).click();

    await expect(page.getByText('already exists in this scope')).toBeVisible();
    await expect(field(page, 'Name')).toBeFocused();
  });

  test('edits a memory', async ({ page, seed }) => {
    const memory = await seed.memory();
    await page.goto(`/memories/${memory.id}`);
    await page.getByRole('link', { name: 'Edit' }).click();

    await field(page, 'Description').fill('Use pnpm 12 or newer');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByRole('status')).toHaveText('Memory saved.');
    await expect(page.getByText('Use pnpm 12 or newer')).toBeVisible();
  });

  test('deletes only after confirmation, and Escape cancels', async ({ page, seed }) => {
    const memory = await seed.memory();
    await page.goto(`/memories/${memory.id}`);
    const dialog = page.getByRole('alertdialog', { name: 'Delete this memory?' });
    const trigger = page.getByRole('button', { name: 'Delete', exact: true });

    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(memory.name);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await dialog.getByRole('button', { name: 'Delete memory' }).click();

    await expect(page).toHaveURL(/\/memories\?deleted=1$/);
    await expect(page.getByRole('status')).toHaveText('Memory deleted.');
    expect((await seed.api.get(`/v1/memories/${memory.id}`)).status()).toBe(404);
  });

  test('paginates long lists', async ({ page, project, seed }) => {
    await Promise.all(
      Array.from({ length: 21 }, (_, index) =>
        seed.memory({ name: `m-${String(index).padStart(2, '0')}` }),
      ),
    );
    await page.goto(`/memories?project=${encodeURIComponent(project)}&global=exclude`);
    const items = page.getByRole('list', { name: 'Memories' }).getByRole('listitem');

    await expect(items).toHaveCount(20);
    await expect(page.getByText('Page 1 of 2')).toBeVisible();
    await page.getByRole('link', { name: 'Next' }).click();
    await expect(items).toHaveCount(1);
    await expect(page.getByText('Page 2 of 2')).toBeVisible();
  });

  test('explains an invalid project filter instead of failing', async ({ page }) => {
    // Regression: OWASP ZAP found this exact URL returning a 500.
    const response = await page.goto('/memories?global=include&project=ZAP&type=user');

    expect(response?.status()).toBe(200);
    await expect(field(page, 'Project')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('must be a normalized git remote')).toBeVisible();
    await expect(page.getByText('No memories here yet')).toBeVisible();
  });

  test('the home page goes straight to the list', async ({ page, request }) => {
    const redirect = await request.get('/', { maxRedirects: 0 });
    expect(redirect.status()).toBe(307);
    expect(redirect.headers().location).toMatch(/\/memories$/);
    // Next.js writes the target as a short body: it must declare its type (ZAP 10019).
    expect(redirect.headers()['content-type']).toMatch(/^text\/plain/);

    await page.goto('/');
    await expect(page).toHaveURL(/\/memories$/);
  });

  test('shows a not-found page for unknown or malformed ids', async ({ page }) => {
    for (const id of [randomUUID(), 'not-an-id']) {
      await page.goto(`/memories/${id}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Not found' })).toBeVisible();
    }
  });

  test('the skip link moves focus to the main content', async ({ page }) => {
    await page.goto('/memories');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  });
});

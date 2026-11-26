import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect, memoryIdFrom, test } from '../fixtures.js';

/** The README promises forms work without JavaScript: this project runs with it disabled. */
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });

test.describe('Without JavaScript', () => {
  test('creates a memory', async ({ page, project, seed }) => {
    const name = `no-js-${randomUUID()}`;
    await page.goto(`/memories/new?project=${encodeURIComponent(project)}`);
    await field(page, 'Name').fill(name);
    await field(page, 'Description').fill('Saved without JavaScript');
    await field(page, 'Content').fill('Plain HTML form post to a Server Action.');
    await page.getByRole('button', { name: 'Create memory' }).click();

    await expect(page.getByRole('status')).toHaveText('Memory saved.');
    seed.track(memoryIdFrom(page));
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  });

  test('shows validation errors and keeps the input', async ({ page, project }) => {
    await page.goto(`/memories/new?project=${encodeURIComponent(project)}`);
    await field(page, 'Type').selectOption('user');
    await field(page, 'Name').fill('Not Kebab');
    await field(page, 'Description').fill('Kept after the error');
    await page.getByRole('button', { name: 'Create memory' }).click();

    await expect(page.getByText('must be kebab-case')).toBeVisible();
    await expect(field(page, 'Type')).toHaveValue('user');
    await expect(field(page, 'Description')).toHaveValue('Kept after the error');
  });

  test('filters the list', async ({ page, project, seed }) => {
    const memory = await seed.memory();
    await page.goto('/memories');
    await field(page, 'Project').fill(project);
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByRole('link', { name: memory.name })).toBeVisible();
  });
});

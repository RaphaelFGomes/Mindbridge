import { randomUUID } from 'node:crypto';
import { expect, expectAccessible, test } from '../fixtures.js';

/** axe-core (WCAG 2.2 A/AA) on every signed-in page and state. The login page is in auth.spec.ts. */
test.describe('Accessibility', () => {
  test('memories list', async ({ page, project, seed }) => {
    await seed.memory({ type: 'user' });
    await seed.memory({ type: 'reference' });
    await page.goto(`/memories?project=${encodeURIComponent(project)}`);
    await expect(page.getByRole('list', { name: 'Memories' })).toBeVisible();
    await expectAccessible(page);
  });

  test('empty list', async ({ page, project }) => {
    await page.goto(`/memories?project=${encodeURIComponent(project)}&global=exclude`);
    await expect(page.getByText('No memories here yet')).toBeVisible();
    await expectAccessible(page);
  });

  test('list with an invalid filter', async ({ page }) => {
    await page.goto('/memories?project=ZAP');
    await expect(page.getByText('must be a normalized git remote')).toBeVisible();
    await expectAccessible(page);
  });

  test('new memory form, before and after a validation error', async ({ page }) => {
    await page.goto('/memories/new');
    await expectAccessible(page);

    await page.getByRole('button', { name: 'Create memory' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await expectAccessible(page);
  });

  test('memory page and edit form', async ({ page, seed }) => {
    const memory = await seed.memory({ content: '# Heading\n\n- a list\n- of facts' });
    await page.goto(`/memories/${memory.id}`);
    await expectAccessible(page);

    await page.goto(`/memories/${memory.id}/edit`);
    await expectAccessible(page);
  });

  test('delete confirmation dialog', async ({ page, seed }) => {
    const memory = await seed.memory();
    await page.goto(`/memories/${memory.id}`);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expectAccessible(page);
  });

  test('not-found page', async ({ page }) => {
    await page.goto(`/memories/${randomUUID()}`);
    await expectAccessible(page);
  });
});

import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.js';

/** Chromium logs every blocked script, style or connection to the console. */
function collectCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to (execute|load|apply|connect)/i.test(message.text())) {
      violations.push(message.text());
    }
  });
  return violations;
}

test.describe('Security headers', () => {
  test('every page runs under a nonce-based CSP without violations', async ({ page, seed }) => {
    const violations = collectCspViolations(page);
    const memory = await seed.memory();

    const first = await page.goto('/memories');
    const second = await page.goto('/memories');
    const policy = first?.headers()['content-security-policy'] ?? '';
    expect(policy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(policy).not.toContain('unsafe-eval');
    // A fresh nonce for every response.
    expect(second?.headers()['content-security-policy']).not.toBe(policy);

    // Hydrated interactions still work under the policy.
    await page.goto(`/memories/${memory.id}`);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.goto('/memories/new');
    await page.getByRole('button', { name: 'Create memory' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();

    expect(violations).toEqual([]);
  });

  test('pages send the hardening headers', async ({ page }) => {
    const response = await page.goto('/memories');
    expect(response?.headers()).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'same-origin',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-resource-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
    });
    expect(response?.headers()['permissions-policy']).toContain('camera=()');
    expect(response?.headers()['x-powered-by']).toBeUndefined();
  });

  test('the login page is covered too', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL: baseURL ?? '' });
    const page = await context.newPage();
    const response = await page.goto('/login');
    expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    await context.close();
  });
});

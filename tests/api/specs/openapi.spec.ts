import { expect, test } from '../fixtures.js';

test.describe('OpenAPI document', () => {
  test('is OpenAPI 3.1 with a title and a version', ({ contract }) => {
    expect(contract.document.openapi).toBe('3.1.0');
    expect(contract.document.info).toMatchObject({
      title: 'Mindbridge API',
      version: expect.stringMatching(/^\d+\.\d+\.\d+$/),
    });
  });

  test('gives every operation a summary, a tag and documented error responses', ({ contract }) => {
    const operations = Object.entries(contract.document.paths).flatMap(([path, methods]) =>
      Object.entries(methods ?? {}).map(([method, operation]) => ({
        label: `${method.toUpperCase()} ${path}`,
        operation,
        hasInput: path.includes('{') || method !== 'get' || path === '/v1/memories',
      })),
    );

    expect(operations.length).toBeGreaterThan(0);
    for (const { label, operation, hasInput } of operations) {
      expect.soft(operation.summary, `${label} summary`).toBeTruthy();
      expect.soft(operation.tags?.length, `${label} tags`).toBeGreaterThan(0);
      if (hasInput) {
        expect.soft(Object.keys(operation.responses), `${label} documents 400`).toContain('400');
      }
    }
  });

  test('is browsable through Swagger UI at /docs', async ({ request }) => {
    const response = await request.get('/docs');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
  });
});

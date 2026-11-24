import { expect, test } from '../fixtures.js';

const FORGED_KEY = `mb_${'A'.repeat(43)}`;

test.describe('Authentication', () => {
  test('rejects requests without an API key', async ({ request, contract }) => {
    const response = await request.get('/v1/memories');

    await contract.verify(response, 'get', '/v1/memories');
    expect(response.status()).toBe(401);
    expect(response.headers()['www-authenticate']).toBe('Bearer realm="mindbridge"');
    expect(await response.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('rejects a forged key before validating the body', async ({ request, contract }) => {
    const response = await request.post('/v1/memories', {
      headers: { authorization: `Bearer ${FORGED_KEY}` },
      data: { not: 'a memory' },
    });

    await contract.verify(response, 'post', '/v1/memories');
    expect(response.status()).toBe(401);
    expect(await response.json()).not.toHaveProperty('errors');
  });

  test('accepts the test run key', async ({ api, contract }) => {
    const response = await api.get('/v1/memories', { params: { limit: 1 } });

    await contract.verify(response, 'get', '/v1/memories');
    expect(response.status()).toBe(200);
  });

  for (const path of ['/health', '/openapi.json', '/docs']) {
    test(`does not require a key for ${path}`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(200);
    });
  }
});

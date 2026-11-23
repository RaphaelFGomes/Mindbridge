import { expect, test } from '../fixtures.js';

test('GET /health reports the API and its database as up', async ({ request, contract }) => {
  const response = await request.get('/health');

  await contract.verify(response, 'get', '/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok', checks: { database: 'up' } });
});

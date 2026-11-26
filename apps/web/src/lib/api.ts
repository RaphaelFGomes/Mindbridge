import 'server-only';
import { createApiClient, MindbridgeApiError, type ApiClient } from '@mindbridge/api-client';
import { redirect } from 'next/navigation';
import { credentials } from './session';

export const API_URL = process.env.MINDBRIDGE_API_URL ?? 'http://127.0.0.1:4000';

export const apiFor = (apiKey: string): ApiClient => createApiClient({ baseUrl: API_URL, apiKey });

/**
 * Runs `operation` with the current API client. A revoked or deleted session
 * key sends the user back to the login page; a rejected MINDBRIDGE_API_KEY is
 * a configuration error (redirecting would loop, since it skips the login).
 */
export async function withApi<T>(operation: (api: ApiClient) => Promise<T>): Promise<T> {
  const current = await credentials();
  if (!current) redirect('/login');

  try {
    return await operation(apiFor(current.key));
  } catch (error) {
    if (error instanceof MindbridgeApiError && error.status === 401) {
      if (current.source === 'env') {
        throw new Error('MINDBRIDGE_API_KEY was rejected by the API: it is invalid or revoked.', {
          cause: error,
        });
      }
      redirect('/login?expired=1');
    }
    throw error;
  }
}

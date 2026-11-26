'use server';

import { MindbridgeApiError } from '@mindbridge/api-client';
import { redirect } from 'next/navigation';
import { apiFor, API_URL } from '@/lib/api';
import { safeNextPath } from '@/lib/navigation';
import { endSession, startSession } from '@/lib/session';

export interface SignInState {
  error?: string;
}

const API_KEY = /^mb_[A-Za-z0-9_-]{43}$/;

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const submitted = formData.get('apiKey');
  const apiKey = typeof submitted === 'string' ? submitted.trim() : '';
  if (!API_KEY.test(apiKey)) {
    return {
      error: 'That does not look like a Mindbridge API key (mb_ followed by 43 characters).',
    };
  }

  // Check the key against the API before trusting it.
  try {
    await apiFor(apiKey).list({ limit: 1 });
  } catch (error) {
    if (!(error instanceof MindbridgeApiError)) throw error;
    if (error.status === 401) return { error: 'This API key is not valid or has been revoked.' };
    if (error.code === 'API_UNREACHABLE')
      return { error: `Cannot reach the Mindbridge API at ${API_URL}.` };
    return { error: error.message };
  }

  await startSession(apiKey);
  redirect(safeNextPath(formData.get('next')));
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect('/login');
}

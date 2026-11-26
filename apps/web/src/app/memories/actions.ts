'use server';

import { MindbridgeApiError } from '@mindbridge/api-client';
import { redirect } from 'next/navigation';
import { withApi } from '@/lib/api';
import {
  readValues,
  toFormState,
  toMemoryPatch,
  toNewMemory,
  type FormState,
} from '@/lib/memory-form';

// redirect() works by throwing, so it is always called outside try/catch.

export async function createMemory(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = readValues(formData);
  let id: string;
  try {
    ({ id } = await withApi((api) => api.create(toNewMemory(values))));
  } catch (error) {
    return toFormState(error, values);
  }
  redirect(`/memories/${id}?saved=1`);
}

export async function updateMemory(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = readValues(formData);
  try {
    await withApi((api) => api.update(id, toMemoryPatch(values)));
  } catch (error) {
    return toFormState(error, values);
  }
  redirect(`/memories/${id}?saved=1`);
}

export async function deleteMemory(id: string): Promise<void> {
  try {
    await withApi((api) => api.remove(id));
  } catch (error) {
    // Already gone (e.g. deleted from another assistant): the outcome is the same.
    if (!(error instanceof MindbridgeApiError && error.status === 404)) throw error;
  }
  redirect('/memories?deleted=1');
}

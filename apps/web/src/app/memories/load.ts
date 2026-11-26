import 'server-only';
import { MindbridgeApiError, type Memory } from '@mindbridge/api-client';
import { notFound } from 'next/navigation';
import { withApi } from '@/lib/api';

/** A memory by id, or the 404 page for unknown or malformed ids. */
export async function loadMemory(id: string): Promise<Memory> {
  try {
    return await withApi((api) => api.get(id));
  } catch (error) {
    if (error instanceof MindbridgeApiError && (error.status === 404 || error.status === 400))
      notFound();
    throw error;
  }
}

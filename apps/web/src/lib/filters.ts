import { MindbridgeApiError, type ListQuery, type MemoryType } from '@mindbridge/api-client';

export const MEMORY_TYPES = [
  'user',
  'feedback',
  'project',
  'reference',
] as const satisfies readonly MemoryType[];
export const PAGE_SIZE = 20;

export interface Filters {
  project?: string;
  type?: MemoryType;
  includeGlobal: boolean;
  page: number;
}

type SearchParams = Record<string, string | string[] | undefined>;

/** First value of a query parameter; blank counts as absent. */
const first = (value: string | string[] | undefined) => {
  const trimmed = (Array.isArray(value) ? value[0] : value)?.trim();
  return trimmed === '' ? undefined : trimmed;
};

const isMemoryType = (value: string | undefined): value is MemoryType =>
  MEMORY_TYPES.includes(value as MemoryType);

/** Reads list filters from the URL, ignoring anything invalid instead of failing. */
export function parseFilters(params: SearchParams): Filters {
  const type = first(params.type);
  const page = Number.parseInt(first(params.page) ?? '1', 10);
  return {
    ...(first(params.project) && { project: first(params.project)?.toLowerCase() }),
    ...(isMemoryType(type) && { type }),
    includeGlobal: first(params.global) !== 'exclude',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

export function toListQuery(filters: Filters): ListQuery {
  return {
    ...(filters.project && {
      project: filters.project,
      includeGlobal: filters.includeGlobal ? 'true' : 'false',
    }),
    ...(filters.type && { type: filters.type }),
    limit: PAGE_SIZE,
    offset: (filters.page - 1) * PAGE_SIZE,
  };
}

/** URL of the list with the same filters on another page. */
export function pageHref(filters: Filters, page: number): string {
  const params = new URLSearchParams();
  if (filters.project) params.set('project', filters.project);
  if (filters.type) params.set('type', filters.type);
  if (!filters.includeGlobal) params.set('global', 'exclude');
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/memories?${query}` : '/memories';
}

export interface FilterProblem {
  /** Shown under the project field. */
  project?: string;
  /** Shown above the list when the problem is not about one field. */
  message?: string;
}

/**
 * Filters the API rejects (400, e.g. a project that is not a normalized git
 * remote) become a message on the form instead of an error page. Anything else
 * is rethrown.
 */
export function toFilterProblem(error: unknown): FilterProblem {
  if (!(error instanceof MindbridgeApiError && error.status === 400)) throw error;
  const project = error.fieldErrors.find((field) => field.path.split('.').pop() === 'project');
  return project ? { project: project.message } : { message: error.message };
}

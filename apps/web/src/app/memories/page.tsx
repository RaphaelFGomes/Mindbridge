import type { Memory } from '@mindbridge/api-client';
import type { Metadata } from 'next';
import Link from 'next/link';
import { TypeBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Notice } from '@/components/ui/notice';
import { withApi } from '@/lib/api';
import { MEMORY_TYPES, PAGE_SIZE, pageHref, parseFilters, toListQuery } from '@/lib/filters';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Memories' };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function MemoryItem({ memory }: { memory: Memory }) {
  return (
    <li className="grid gap-1 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/memories/${memory.id}`}
          className="rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {memory.name}
        </Link>
        <TypeBadge type={memory.type} />
        <span className="font-mono text-xs text-muted-foreground">
          {memory.project ?? 'global'}
        </span>
      </div>
      <p className="text-sm">{memory.description}</p>
      <p className="text-xs text-muted-foreground">Updated {formatDate(memory.updatedAt)}</p>
    </li>
  );
}

export default async function MemoriesPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const { items, total } = await withApi((api) => api.list(toListQuery(filters)));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const newHref = filters.project
    ? `/memories/new?project=${encodeURIComponent(filters.project)}`
    : '/memories/new';

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Memories</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'memory' : 'memories'}
          </p>
        </div>
        <Button asChild>
          <Link href={newHref}>New memory</Link>
        </Button>
      </div>

      {params.deleted === '1' && <Notice>Memory deleted.</Notice>}

      <search>
        <form
          method="get"
          action="/memories"
          className="grid gap-4 rounded-lg border p-4 sm:grid-cols-4 sm:items-start"
        >
          <Field id="filter-project" label="Project">
            {(control) => (
              <Input
                {...control}
                name="project"
                placeholder="github.com/acme/widgets"
                defaultValue={filters.project ?? ''}
              />
            )}
          </Field>
          <Field id="filter-type" label="Type">
            {(control) => (
              <Select {...control} name="type" defaultValue={filters.type ?? ''}>
                <option value="">All types</option>
                {MEMORY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="filter-global" label="Global memories" hint="With a project filter">
            {(control) => (
              <Select
                {...control}
                name="global"
                defaultValue={filters.includeGlobal ? 'include' : 'exclude'}
              >
                <option value="include">Include</option>
                <option value="exclude">Exclude</option>
              </Select>
            )}
          </Field>
          {/* sm:mt-6.5 = label height + gap, so the buttons line up with the controls. */}
          <div className="flex gap-2 sm:mt-6.5">
            <Button type="submit">Apply</Button>
            <Button asChild variant="outline">
              <Link href="/memories">Reset</Link>
            </Button>
          </div>
        </form>
      </search>

      {items.length === 0 ? (
        <div className="grid gap-2 rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">No memories here yet</p>
          <p className="text-sm text-muted-foreground">
            Save one from an assistant over MCP, or{' '}
            <Link href={newHref} className="underline">
              create it here
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="grid gap-3" aria-label="Memories">
          {items.map((memory) => (
            <MemoryItem key={memory.id} memory={memory} />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-4 text-sm">
          {filters.page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(filters, filters.page - 1)}>Previous</Link>
            </Button>
          ) : (
            <span />
          )}
          <span aria-current="page">
            Page {filters.page} of {pages}
          </span>
          {filters.page < pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(filters, filters.page + 1)}>Next</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

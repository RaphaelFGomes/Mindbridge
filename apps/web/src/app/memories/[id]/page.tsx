import type { Metadata } from 'next';
import Link from 'next/link';
import { DeleteMemory } from '@/components/delete-memory';
import { TypeBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { formatDate } from '@/lib/utils';
import { deleteMemory } from '../actions';
import { loadMemory } from '../load';

export const metadata: Metadata = { title: 'Memory' };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MemoryPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { saved } = await searchParams;
  const memory = await loadMemory(id);

  return (
    <article className="grid gap-6">
      {saved === '1' && <Notice>Memory saved.</Notice>}

      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{memory.name}</h1>
          <TypeBadge type={memory.type} />
        </div>
        <p className="text-muted-foreground">{memory.description}</p>
      </header>

      {/* Raw markdown: React escapes it, so stored content can never inject HTML. */}
      <pre className="rounded-lg border bg-muted p-4 font-mono text-sm whitespace-pre-wrap">
        {memory.content}
      </pre>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Scope</dt>
        <dd>{memory.project ?? 'global'}</dd>
        <dt className="text-muted-foreground">Created</dt>
        <dd>{formatDate(memory.createdAt)}</dd>
        <dt className="text-muted-foreground">Updated</dt>
        <dd>{formatDate(memory.updatedAt)}</dd>
      </dl>

      <div className="flex gap-2">
        <Button asChild>
          <Link href={`/memories/${memory.id}/edit`}>Edit</Link>
        </Button>
        <DeleteMemory name={memory.name} action={deleteMemory.bind(null, memory.id)} />
        <Button asChild variant="outline">
          <Link href="/memories">Back to memories</Link>
        </Button>
      </div>
    </article>
  );
}

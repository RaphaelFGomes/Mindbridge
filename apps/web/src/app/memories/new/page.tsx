import type { Metadata } from 'next';
import { MemoryForm } from '@/components/memory-form';
import { createMemory } from '../actions';

export const metadata: Metadata = { title: 'New memory' };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewMemoryPage({ searchParams }: Props) {
  const { project } = await searchParams;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">New memory</h1>
      <MemoryForm
        action={createMemory}
        cancelHref="/memories"
        {...(typeof project === 'string' && project && { defaultProject: project })}
      />
    </div>
  );
}

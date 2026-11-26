import type { Metadata } from 'next';
import { MemoryForm } from '@/components/memory-form';
import { updateMemory } from '../../actions';
import { loadMemory } from '../../load';

export const metadata: Metadata = { title: 'Edit memory' };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditMemoryPage({ params }: Props) {
  const { id } = await params;
  const memory = await loadMemory(id);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Edit {memory.name}</h1>
      <MemoryForm
        action={updateMemory.bind(null, memory.id)}
        memory={memory}
        cancelHref={`/memories/${memory.id}`}
      />
    </div>
  );
}

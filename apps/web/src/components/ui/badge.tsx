import type { MemoryType } from '@mindbridge/api-client';
import { cn } from '@/lib/utils';

// Light backgrounds with dark text: every pair passes WCAG AA.
const styles: Record<MemoryType, string> = {
  user: 'bg-violet-100 text-violet-900',
  feedback: 'bg-amber-100 text-amber-900',
  project: 'bg-sky-100 text-sky-900',
  reference: 'bg-emerald-100 text-emerald-900',
};

export function TypeBadge({ type }: { type: MemoryType }) {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', styles[type])}>
      {type}
    </span>
  );
}

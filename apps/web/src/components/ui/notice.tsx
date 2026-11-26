import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface NoticeProps {
  tone?: 'info' | 'error';
  children: ReactNode;
}

/** Inline message. Errors are announced immediately; info politely. */
export function Notice({ tone = 'info', children }: NoticeProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      // Focus target after a failed submit (not in the tab order).
      {...(tone === 'error' && { tabIndex: -1 })}
      className={cn(
        'rounded-md border px-4 py-3 text-sm',
        tone === 'error' ? 'border-destructive/40 bg-red-50 text-red-900' : 'bg-muted',
      )}
    >
      {children}
    </div>
  );
}

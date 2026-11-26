'use client';

import { Button } from '@/components/ui/button';

/** Unexpected failures (API down, bugs): a way out instead of a blank page. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">
        The Mindbridge API may be unavailable. Try again in a moment.
      </p>
      <div>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}

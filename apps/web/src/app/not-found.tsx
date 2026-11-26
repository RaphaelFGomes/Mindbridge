import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-muted-foreground">This memory does not exist or was deleted.</p>
      <div>
        <Button asChild variant="outline">
          <Link href="/memories">Back to memories</Link>
        </Button>
      </div>
    </div>
  );
}

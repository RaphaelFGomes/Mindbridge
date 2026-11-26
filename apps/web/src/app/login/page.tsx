import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Notice } from '@/components/ui/notice';
import { safeNextPath } from '@/lib/navigation';
import { credentials } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  // A configured MINDBRIDGE_API_KEY makes the login page unnecessary.
  if ((await credentials())?.source === 'env') redirect(safeNextPath(params.next));

  return (
    <div className="mx-auto grid max-w-sm gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Use a Mindbridge API key. Create one with{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            pnpm keys:create --name web
          </code>
          .
        </p>
      </div>
      {params.expired === '1' && (
        <Notice>Your session ended because the key is no longer valid. Sign in again.</Notice>
      )}
      <LoginForm next={safeNextPath(params.next)} />
    </div>
  );
}

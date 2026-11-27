import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { credentials } from '@/lib/session';
import { signOut } from './actions';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Mindbridge', template: '%s · Mindbridge' },
  description: 'Shared memory for your AI assistants.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const current = await credentials();
  const signedIn = current !== null;

  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <a
          href="#main"
          className="sr-only rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <header className="border-b">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
            <Link
              href={signedIn ? '/memories' : '/login'}
              className="rounded-sm text-lg font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Mindbridge
            </Link>
            {signedIn && (
              <nav aria-label="Main" className="flex flex-wrap items-center gap-2">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/memories">Memories</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/memories/new">New memory</Link>
                </Button>
                {current.source === 'cookie' ? (
                  <form action={signOut}>
                    <Button type="submit" variant="outline" size="sm">
                      Sign out
                    </Button>
                  </form>
                ) : (
                  <span className="text-xs text-muted-foreground">Using MINDBRIDGE_API_KEY</span>
                )}
              </nav>
            )}
          </div>
        </header>
        {/* tabIndex -1: the skip link moves focus here, not just the scroll position. */}
        <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-8 focus:outline-none">
          {children}
        </main>
      </body>
    </html>
  );
}

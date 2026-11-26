'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { signIn, type SignInState } from '../actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <Field
        id="apiKey"
        label="API key"
        hint="Starts with mb_. It stays on the server: this browser only gets a session cookie."
        {...(state.error && { error: state.error })}
      >
        {(control) => (
          <Input
            {...control}
            name="apiKey"
            type="password"
            autoComplete="off"
            spellCheck={false}
            required
          />
        )}
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

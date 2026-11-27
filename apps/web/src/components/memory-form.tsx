'use client';

import type { Memory } from '@mindbridge/api-client';
import Link from 'next/link';
import { startTransition, useActionState, useEffect, useRef, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Label, Select, Textarea } from '@/components/ui/field';
import { Notice } from '@/components/ui/notice';
import { MEMORY_TYPES } from '@/lib/filters';
import type { Field as FieldName, FormState } from '@/lib/memory-form';

const TYPE_HINTS = {
  user: 'Who the user is: role, expertise, preferences',
  feedback: 'How assistants should work with the user',
  project: 'Goals, decisions and constraints of a project',
  reference: 'Pointers to external resources',
} as const;

interface MemoryFormProps {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** Editing an existing memory; omitted when creating. */
  memory?: Memory;
  /** Pre-filled project when creating from a filtered list. */
  defaultProject?: string;
  cancelHref: string;
}

export function MemoryForm({ action, memory, defaultProject, cancelHref }: MemoryFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  // After a failed submit, move focus to the first invalid field (or the summary),
  // so keyboard and screen-reader users land on what needs fixing.
  useEffect(() => {
    if (!state.message) return;
    const form = formRef.current;
    const target =
      form?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      form?.querySelector<HTMLElement>('[role="alert"]');
    target?.focus();
  }, [state]);

  // React resets uncontrolled fields after a <form action> completes, and a
  // <select> snaps back to its first-render value: after a validation error the
  // type and scope would silently revert. Submitting through a transition skips
  // that reset. Without JavaScript, `action` still posts the form.
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  };
  const errors = state.fieldErrors ?? {};
  const value = (field: FieldName) => state.values?.[field] ?? memory?.[field] ?? '';
  const creating = memory === undefined;
  const scope = state.values?.scope ?? (defaultProject ? 'project' : 'global');

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={submit}
      noValidate
      className="grid max-w-2xl gap-5"
    >
      {state.message && <Notice tone="error">{state.message}</Notice>}

      <Field
        id="type"
        label="Type"
        hint="What kind of fact this is"
        {...(errors.type && { error: errors.type })}
      >
        {(control) => (
          <Select {...control} name="type" defaultValue={value('type') || 'feedback'} required>
            {MEMORY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}: {TYPE_HINTS[type]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        id="name"
        label="Name"
        hint="kebab-case, unique in its scope, e.g. prefers-pnpm"
        {...(errors.name && { error: errors.name })}
      >
        {(control) => <Input {...control} name="name" defaultValue={value('name')} required />}
      </Field>

      <Field
        id="description"
        label="Description"
        hint="One line that tells assistants when this memory is relevant"
        {...(errors.description && { error: errors.description })}
      >
        {(control) => (
          <Input
            {...control}
            name="description"
            defaultValue={value('description')}
            maxLength={200}
            required
          />
        )}
      </Field>

      <Field
        id="content"
        label="Content"
        hint="The fact itself, in markdown"
        {...(errors.content && { error: errors.content })}
      >
        {(control) => (
          <Textarea {...control} name="content" defaultValue={value('content')} required />
        )}
      </Field>

      {creating ? (
        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-medium">Scope</legend>
          <div className="flex items-center gap-2">
            <input
              id="scope-global"
              type="radio"
              name="scope"
              value="global"
              defaultChecked={scope === 'global'}
            />
            <Label htmlFor="scope-global" className="font-normal">
              Global: every project
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="scope-project"
              type="radio"
              name="scope"
              value="project"
              defaultChecked={scope === 'project'}
            />
            <Label htmlFor="scope-project" className="font-normal">
              One project
            </Label>
          </div>
          <Field
            id="project"
            label="Project"
            hint="Normalized git remote, e.g. github.com/acme/widgets (used when the scope is one project)"
            {...(errors.project && { error: errors.project })}
          >
            {(control) => (
              <Input
                {...control}
                name="project"
                defaultValue={state.values?.project ?? defaultProject ?? ''}
              />
            )}
          </Field>
        </fieldset>
      ) : (
        <p className="text-sm text-muted-foreground">
          Scope: <code className="font-mono">{memory.project ?? 'global'}</code> (cannot be changed)
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : creating ? 'Create memory' : 'Save changes'}
        </Button>
        <Button asChild variant="outline">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

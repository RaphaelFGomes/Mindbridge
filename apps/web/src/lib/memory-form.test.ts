import { MindbridgeApiError } from '@mindbridge/api-client';
import { describe, expect, it } from 'vitest';
import { readValues, toFormState, toMemoryPatch, toNewMemory } from './memory-form';

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

const values = readValues(
  form({
    type: 'feedback',
    name: 'prefers-pnpm',
    description: 'Use pnpm',
    content: 'The team uses pnpm.',
    scope: 'project',
    project: ' GitHub.com/Acme/Widgets ',
  }),
);

describe('payloads', () => {
  it('creates a project memory with a normalized project key', () => {
    expect(toNewMemory(values)).toEqual({
      type: 'feedback',
      name: 'prefers-pnpm',
      description: 'Use pnpm',
      content: 'The team uses pnpm.',
      project: 'github.com/acme/widgets',
    });
  });

  it('creates a global memory when the global scope is chosen', () => {
    expect(toNewMemory({ ...values, scope: 'global' }).project).toBeNull();
  });

  it('sends only the editable fields when editing (the project cannot change)', () => {
    expect(toMemoryPatch(values)).toEqual({
      type: 'feedback',
      name: 'prefers-pnpm',
      description: 'Use pnpm',
      content: 'The team uses pnpm.',
    });
  });

  it('reads every field, including the scope', () => {
    expect(values).toMatchObject({ scope: 'project', project: ' GitHub.com/Acme/Widgets ' });
  });

  it('reads missing fields as empty strings, and files as empty', () => {
    const data = form({ name: 'x' });
    data.set('content', new Blob(['binary']));
    expect(readValues(data)).toMatchObject({ name: 'x', type: '', content: '' });
  });
});

describe('toFormState', () => {
  it('maps API field errors onto form fields', () => {
    const error = new MindbridgeApiError(400, 'VALIDATION_ERROR', 'The request is invalid.', [
      { path: 'body.name', message: 'must be kebab-case' },
      { path: 'body.name', message: 'too long' },
      { path: 'body.content', message: 'must not be blank' },
      { path: 'body', message: 'unrecognized key' },
    ]);

    expect(toFormState(error, values)).toEqual({
      values,
      message: 'Please fix the highlighted fields.',
      fieldErrors: { name: 'must be kebab-case', content: 'must not be blank' },
    });
  });

  it('explains a duplicate name on the name field', () => {
    const state = toFormState(new MindbridgeApiError(409, 'CONFLICT', 'exists'), values);
    expect(state).toEqual({
      values,
      message: 'Please fix the highlighted field.',
      fieldErrors: { name: 'A memory with this name already exists in this scope.' },
    });
  });

  it('falls back to the API message when no field is involved', () => {
    expect(toFormState(new MindbridgeApiError(500, 'INTERNAL_ERROR', 'Boom'), values)).toEqual({
      values,
      message: 'Boom',
    });
  });

  it('rethrows anything that is not an API error (e.g. redirects)', () => {
    const redirect = new Error('NEXT_REDIRECT');
    expect(() => toFormState(redirect, values)).toThrow(redirect);
  });
});

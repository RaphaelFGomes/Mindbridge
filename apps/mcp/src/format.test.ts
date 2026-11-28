import type { Memory } from '@mindbridge/api-client';
import { describe, expect, it } from 'vitest';
import { renderIndex, renderMemory } from './format.js';

const memory = (overrides: Partial<Memory> = {}): Memory => ({
  id: 'id-1',
  project: 'github.com/acme/widgets',
  type: 'feedback',
  name: 'prefers-pnpm',
  description: 'Use pnpm, never npm',
  content: 'The team uses pnpm.',
  createdAt: '2026-11-25T10:00:00.000Z',
  updatedAt: '2026-11-26T10:00:00.000Z',
  ...overrides,
});

describe('renderMemory', () => {
  it('renders a project memory', () => {
    expect(renderMemory(memory())).toBe(
      [
        '# prefers-pnpm',
        'type: feedback · scope: github.com/acme/widgets · id: id-1',
        'updated: 2026-11-26T10:00:00.000Z',
        '',
        '> Use pnpm, never npm',
        '',
        'The team uses pnpm.',
      ].join('\n'),
    );
  });

  it('calls a memory without project global', () => {
    expect(renderMemory(memory({ project: null }))).toContain('scope: global ·');
  });
});

describe('renderIndex', () => {
  const global = memory({ id: 'id-2', project: null, type: 'user', name: 'prefers-concise' });

  it('lists project memories, then global ones, then how to read one', () => {
    expect(renderIndex([memory(), global], 'github.com/acme/widgets')).toBe(
      [
        '## Project github.com/acme/widgets (1)',
        '- [feedback] prefers-pnpm: Use pnpm, never npm (id: id-1)',
        '## Global (1)',
        '- [user] prefers-concise: Use pnpm, never npm (id: id-2)',
        'Read a memory in full with get_memory and its id.',
      ].join('\n\n'),
    );
  });

  it('puts each memory on its own line', () => {
    const second = memory({ id: 'id-3', name: 'uses-turbo', description: 'Turborepo for tasks' });
    const third = memory({ id: 'id-4', project: null, name: 'tz', description: 'UTC everywhere' });
    const sections = renderIndex(
      [memory(), second, global, third],
      'github.com/acme/widgets',
    ).split('\n\n');
    expect(sections[1]?.split('\n')).toHaveLength(2);
    expect(sections[3]?.split('\n')).toHaveLength(2);
  });

  it('says when a section is empty', () => {
    expect(renderIndex([], 'github.com/acme/widgets')).toBe(
      [
        '## Project github.com/acme/widgets (0)',
        '(none yet)',
        '## Global (0)',
        '(none yet)',
        'Read a memory in full with get_memory and its id.',
      ].join('\n\n'),
    );
  });

  it('explains global-only mode when no project is detected', () => {
    const text = renderIndex([global], null);
    expect(text.split('\n\n')[0]).toMatch(/^No project detected/);
    expect(text).not.toContain('## Project');
    expect(text).toContain('## Global (1)');
  });
});

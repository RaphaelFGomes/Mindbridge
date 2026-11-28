import { sleep } from 'k6';
import exec from 'k6/execution';
import { createMemory, deleteMemory, getMemory, listMemories, updateMemory } from './api.ts';
import { API_KEY, MEMORY_TYPES } from './config.ts';

export interface SetupData {
  project: string;
  ids: string[];
}

const pick = <T>(values: readonly T[]): T => values[Math.floor(Math.random() * values.length)] as T;

/** A project of its own for this run, seeded with `count` memories (runs once, before the VUs). */
export function seed(count = 50): SetupData {
  if (!API_KEY) {
    throw new Error('Set the key: k6 run -e MINDBRIDGE_API_KEY=mb_... <scenario>');
  }
  const project = `github.com/k6/run-${Date.now()}`;
  const ids: string[] = [];
  for (let index = 0; index < count; index++) {
    const memory = createMemory(
      {
        project,
        type: MEMORY_TYPES[index % MEMORY_TYPES.length],
        name: `seed-${index}`,
        description: `Seeded memory ${index}`,
        content: 'Seeded for the performance test. '.repeat(10),
      },
      'setup',
    );
    if (memory) ids.push(memory.id);
  }
  return { project, ids };
}

/**
 * One iteration, weighted like real use. Mostly reads: an assistant loads the
 * project index (what the MCP server's `memory_index` does), a person pages
 * through the web UI, either opens a memory. Sometimes a full write cycle, which
 * cleans up after itself so a long soak doesn't grow the database.
 */
export function journey({ project, ids }: SetupData): void {
  const roll = Math.random();
  if (roll < 0.3) {
    listMemories('index', { project, limit: 100 });
  } else if (roll < 0.6) {
    listMemories('page', {
      project,
      includeGlobal: 'false',
      offset: pick([0, 20, 40]),
      ...(Math.random() < 0.3 && { type: pick(MEMORY_TYPES) }),
    });
  } else if (roll < 0.8) {
    getMemory(pick(ids));
  } else {
    const memory = createMemory({
      project,
      type: pick(MEMORY_TYPES),
      name: `vu-${exec.vu.idInTest}-${exec.vu.iterationInScenario}`,
      description: 'Written during the performance test',
      content: 'A fact an assistant just learned.',
    });
    if (memory) {
      updateMemory(memory.id, { content: 'The same fact, refined.' });
      deleteMemory(memory.id);
    }
  }
  sleep(0.5 + Math.random()); // think time: people and assistants pause between calls
}

export function cleanup({ ids }: SetupData): void {
  for (const id of ids) deleteMemory(id, 'setup');
}

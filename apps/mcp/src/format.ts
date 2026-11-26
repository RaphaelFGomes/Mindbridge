import type { Memory } from '@mindbridge/api-client';

const scopeOf = (memory: Memory) => memory.project ?? 'global';

/** Full memory, as an assistant should read it. */
export function renderMemory(memory: Memory): string {
  return [
    `# ${memory.name}`,
    `type: ${memory.type} · scope: ${scopeOf(memory)} · id: ${memory.id}`,
    `updated: ${memory.updatedAt}`,
    '',
    `> ${memory.description}`,
    '',
    memory.content,
  ].join('\n');
}

const line = (memory: Memory) =>
  `- [${memory.type}] ${memory.name}: ${memory.description} (id: ${memory.id})`;

/**
 * A MEMORY.md-style index: one line per memory, project memories first. Cheap to
 * read at the start of a session; full content is one get_memory away.
 */
export function renderIndex(memories: Memory[], project: string | null): string {
  const inProject = memories.filter((memory) => memory.project !== null);
  const global = memories.filter((memory) => memory.project === null);
  const sections: string[] = [];

  if (project === null) {
    sections.push(
      'No project detected (not a git repository with an "origin" remote, and MINDBRIDGE_PROJECT is unset): showing global memories only.',
    );
  } else {
    sections.push(
      `## Project ${project} (${inProject.length})`,
      inProject.length > 0 ? inProject.map(line).join('\n') : '(none yet)',
    );
  }
  sections.push(
    `## Global (${global.length})`,
    global.length > 0 ? global.map(line).join('\n') : '(none yet)',
  );
  sections.push('Read a memory in full with get_memory and its id.');
  return sections.join('\n\n');
}

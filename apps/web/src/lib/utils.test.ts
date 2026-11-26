import { describe, expect, it } from 'vitest';
import { cn, formatDate } from './utils';

describe('formatDate', () => {
  it('renders in UTC and en-US, whatever the machine locale or timezone', () => {
    // \s: recent ICU versions put a narrow no-break space before "PM".
    expect(formatDate('2026-11-26T15:04:00.000Z')).toMatch(/^Nov 26, 2026, 3:04\sPM UTC$/u);
  });
});

describe('cn', () => {
  it('lets later Tailwind classes win', () => {
    expect(cn('px-2 text-sm', false, 'px-4')).toBe('text-sm px-4');
  });
});

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

/** Locale- and timezone-independent, so pages render the same everywhere (and in visual tests). */
export function formatDate(iso: string): string {
  return `${dateFormat.format(new Date(iso))} UTC`;
}

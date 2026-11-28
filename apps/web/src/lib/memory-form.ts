import {
  MindbridgeApiError,
  type MemoryPatch,
  type MemoryType,
  type NewMemory,
} from '@mindbridge/api-client';

export const FIELDS = ['type', 'name', 'description', 'content', 'project'] as const;
export type Field = (typeof FIELDS)[number];

/** Every submitted field, always present (blank when missing). */
export type FormValues = Record<Field | 'scope', string>;

export interface FormState {
  message?: string;
  fieldErrors?: Partial<Record<Field, string>>;
  /** Submitted values, so the form keeps them after an error. */
  values?: FormValues;
}

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
};

export function readValues(formData: FormData): FormValues {
  return {
    type: text(formData, 'type'),
    name: text(formData, 'name'),
    description: text(formData, 'description'),
    content: text(formData, 'content'),
    project: text(formData, 'project'),
    scope: text(formData, 'scope'),
  };
}

/** The API validates everything; the form only shapes the payload. */
export function toNewMemory(values: FormValues): NewMemory {
  return {
    type: values.type as MemoryType,
    name: values.name,
    description: values.description,
    content: values.content,
    project: values.scope === 'global' ? null : values.project.trim().toLowerCase(),
  };
}

export function toMemoryPatch(values: FormValues): MemoryPatch {
  return {
    type: values.type as MemoryType,
    name: values.name,
    description: values.description,
    content: values.content,
  };
}

const isField = (value: string): value is Field => (FIELDS as readonly string[]).includes(value);

/** Maps an API problem onto form fields ("body.name" → name) and a summary message. */
export function toFormState(error: unknown, values: FormValues): FormState {
  if (!(error instanceof MindbridgeApiError)) throw error;

  if (error.status === 409) {
    return {
      values,
      message: 'Please fix the highlighted field.',
      fieldErrors: { name: 'A memory with this name already exists in this scope.' },
    };
  }
  const fieldErrors: FormState['fieldErrors'] = {};
  for (const { path, message } of error.fieldErrors) {
    // Stryker disable next-line Regex,StringLiteral: equivalent — API paths only start with "body.", and split() always yields a first element.
    const field = path.replace(/^body\./, '').split('.')[0] ?? '';
    if (isField(field)) fieldErrors[field] ??= message;
  }
  return Object.keys(fieldErrors).length > 0
    ? { values, message: 'Please fix the highlighted fields.', fieldErrors }
    : { values, message: error.message };
}

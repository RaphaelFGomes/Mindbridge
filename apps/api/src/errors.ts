import { STATUS_CODES } from 'node:http';
import type { FastifyError, FastifyInstance } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';
import { z } from 'zod';

/** RFC 9457 Problem Details, plus a stable machine-readable `code`. */
export const problemSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    code: z.string(),
    detail: z.string().optional(),
    errors: z
      .array(z.object({ path: z.string(), message: z.string() }))
      .optional()
      .describe('Field-level validation errors'),
  })
  .describe('RFC 9457 problem details');

export type Problem = z.infer<typeof problemSchema>;

/** Route response entry for an error status, documented with its real media type. */
export function problemResponse(description: string) {
  return {
    description,
    content: { 'application/problem+json': { schema: problemSchema } },
  };
}
export type FieldError = NonNullable<Problem['errors']>[number];

/** An error that maps directly to an HTTP problem response. */
export class HttpProblem extends Error {
  override name = 'HttpProblem';

  constructor(
    readonly status: number,
    readonly code: string,
    detail: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(detail);
  }
}

export const unauthorized = () =>
  new HttpProblem(
    401,
    'UNAUTHORIZED',
    'A valid API key is required: Authorization: Bearer <key>.',
    // RFC 6750: tell the client which scheme to use.
    { 'www-authenticate': 'Bearer realm="mindbridge"' },
  );
export const notFound = (detail: string) => new HttpProblem(404, 'NOT_FOUND', detail);
export const conflict = (detail: string) => new HttpProblem(409, 'CONFLICT', detail);

export function problem(
  status: number,
  code: string,
  detail?: string,
  errors?: FieldError[],
): Problem {
  return {
    type: 'about:blank',
    title: STATUS_CODES[status] ?? 'Unknown Error',
    status,
    code,
    ...(detail !== undefined && { detail }),
    ...(errors !== undefined && { errors }),
  };
}

type ClientError = FastifyError & { statusCode: number };

/** Fastify's own 4xx errors: malformed JSON, unsupported media type, body too large... */
function isClientError(error: unknown): error is ClientError {
  return (
    error instanceof Error &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  );
}

function toFieldPath(context: string | undefined, instancePath: string): string {
  return [context, ...instancePath.split('/')].filter(Boolean).join('.');
}

/**
 * The problem sent to the client for any error. Client errors (4xx) explain
 * themselves; anything else becomes a generic 500 that never echoes internals.
 */
export function toProblem(error: unknown): Problem {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return problem(
      400,
      'VALIDATION_ERROR',
      'The request is invalid.',
      error.validation.map((issue) => ({
        path: toFieldPath(error.validationContext, issue.instancePath),
        // Stryker disable next-line StringLiteral: fallback for a field Zod always fills.
        message: issue.message ?? 'is invalid',
      })),
    );
  }
  if (error instanceof HttpProblem) return problem(error.status, error.code, error.message);
  if (isClientError(error)) return problem(error.statusCode, error.code, error.message);
  return problem(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const body = toProblem(error);
    if (error instanceof HttpProblem) reply.headers(error.headers);

    // Stryker disable ObjectLiteral,StringLiteral: log payloads and messages, not API behaviour.
    // Stryker disable next-line BlockStatement: no route violates its own response schema.
    if (isResponseSerializationError(error)) {
      // Stryker disable next-line CallExpression: same unreachable branch.
      request.log.error({ err: error, issues: error.cause.issues }, 'Response failed validation');
    } else if (body.status >= 500) {
      request.log.error({ err: error }, 'Unhandled error');
    }
    // Stryker restore ObjectLiteral,StringLiteral

    return reply.code(body.status).type('application/problem+json').send(body);
  });

  app.setNotFoundHandler((request, reply) =>
    reply
      .code(404)
      .type('application/problem+json')
      .send(problem(404, 'ROUTE_NOT_FOUND', `Route ${request.method} ${request.url} not found.`)),
  );
}

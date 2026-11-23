import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';

// ajv-formats is CommonJS with `exports.default`; unwrap it for NodeNext typing.
const addFormats = addFormatsModule as unknown as typeof addFormatsModule.default;

export type Method = 'get' | 'post' | 'patch' | 'delete';

interface MediaType {
  schema: object;
}

interface ResponseObject {
  content?: Record<string, MediaType>;
}

export interface Operation {
  summary?: string;
  tags?: string[];
  responses: Record<string, ResponseObject | undefined>;
}

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Partial<Record<Method, Operation>> | undefined>;
}

/**
 * The published OpenAPI document, used as the oracle: every response must have
 * a documented status, a documented media type, and a body matching its schema.
 */
export class Contract {
  private readonly ajv = new Ajv2020({ strict: false, allErrors: true });
  private readonly validators = new Map<string, ValidateFunction>();

  constructor(readonly document: OpenApiDocument) {
    addFormats(this.ajv);
  }

  async verify(response: APIResponse, method: Method, path: string): Promise<void> {
    const label = `${method.toUpperCase()} ${path}`;
    const operation = this.document.paths[path]?.[method];
    expect(operation, `${label} is not in the OpenAPI document`).toBeDefined();
    if (!operation) return;

    const status = String(response.status());
    const documented = operation.responses[status] ?? operation.responses.default;
    expect(documented, `${label} returned undocumented status ${status}`).toBeDefined();
    if (!documented) return;

    if (!documented.content) {
      expect((await response.body()).length, `${label} ${status} should have no body`).toBe(0);
      return;
    }

    const mediaType = (response.headers()['content-type'] ?? '').split(';')[0]?.trim() ?? '';
    const entry = documented.content[mediaType];
    expect(
      entry,
      `${label} ${status} was served as "${mediaType}"; documented: ${Object.keys(documented.content).join(', ')}`,
    ).toBeDefined();
    if (!entry) return;

    const validate = this.validator(`${label} ${status} ${mediaType}`, entry.schema);
    const body: unknown = await response.json();
    expect(validate(body), `${label} ${status} body: ${this.ajv.errorsText(validate.errors)}`).toBe(
      true,
    );
  }

  private validator(key: string, schema: object): ValidateFunction {
    let validate = this.validators.get(key);
    if (!validate) {
      validate = this.ajv.compile(schema);
      this.validators.set(key, validate);
    }
    return validate;
  }
}

export async function loadContract(request: APIRequestContext): Promise<Contract> {
  const response = await request.get('/openapi.json');
  expect(response.status(), 'GET /openapi.json').toBe(200);
  return new Contract((await response.json()) as OpenApiDocument);
}

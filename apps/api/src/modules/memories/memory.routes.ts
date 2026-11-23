import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { isUniqueViolation } from '../../db/errors.js';
import { conflict, notFound, problemResponse } from '../../errors.js';
import type { MemoryRepository } from './memory.repository.js';
import {
  createMemoryBodySchema,
  listMemoriesQuerySchema,
  memoryIdParamsSchema,
  memoryListSchema,
  memorySchema,
  toMemoryDto,
  updateMemoryBodySchema,
} from './memory.schemas.js';

export interface MemoryRoutesOptions {
  repository: MemoryRepository;
}

const tags = ['memories'];

const invalid = problemResponse('The request is invalid');
const missing = problemResponse('No memory with this id');
const duplicate = problemResponse('A memory with this name already exists in the scope');

async function rethrowConflict<T>(operation: () => Promise<T>, name: string | undefined) {
  try {
    return await operation();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(`A memory named "${name ?? ''}" already exists in this scope.`);
    }
    throw error;
  }
}

export const memoryRoutes: FastifyPluginCallbackZod<MemoryRoutesOptions> = (
  app,
  { repository },
  done,
) => {
  app.post(
    '/memories',
    {
      schema: {
        tags,
        summary: 'Create a memory',
        body: createMemoryBodySchema,
        response: { 201: memorySchema, 400: invalid, 409: duplicate },
      },
    },
    async (request, reply) => {
      const { project = null, ...rest } = request.body;
      const row = await rethrowConflict(
        () => repository.create({ ...rest, project }),
        request.body.name,
      );
      const path = request.url.split('?')[0] ?? request.url;
      return reply.code(201).header('location', `${path}/${row.id}`).send(toMemoryDto(row));
    },
  );

  app.get(
    '/memories',
    {
      schema: {
        tags,
        summary: 'List memories',
        description:
          'Without `project`, lists every memory. With `project`, lists that project plus global memories unless `includeGlobal=false`.',
        querystring: listMemoriesQuerySchema,
        response: { 200: memoryListSchema, 400: invalid },
      },
    },
    async (request) => {
      const { items, total } = await repository.list(request.query);
      return {
        items: items.map(toMemoryDto),
        total,
        limit: request.query.limit,
        offset: request.query.offset,
      };
    },
  );

  app.get(
    '/memories/:id',
    {
      schema: {
        tags,
        summary: 'Get a memory',
        params: memoryIdParamsSchema,
        response: { 200: memorySchema, 400: invalid, 404: missing },
      },
    },
    async (request) => {
      const row = await repository.findById(request.params.id);
      if (!row) throw notFound(`Memory ${request.params.id} not found.`);
      return toMemoryDto(row);
    },
  );

  app.patch(
    '/memories/:id',
    {
      schema: {
        tags,
        summary: 'Update a memory',
        params: memoryIdParamsSchema,
        body: updateMemoryBodySchema,
        response: {
          200: memorySchema,
          400: invalid,
          404: missing,
          409: duplicate,
        },
      },
    },
    async (request) => {
      const row = await rethrowConflict(
        () => repository.update(request.params.id, request.body),
        request.body.name,
      );
      if (!row) throw notFound(`Memory ${request.params.id} not found.`);
      return toMemoryDto(row);
    },
  );

  app.delete(
    '/memories/:id',
    {
      schema: {
        tags,
        summary: 'Delete a memory',
        params: memoryIdParamsSchema,
        response: {
          204: z.undefined().describe('Memory deleted'),
          400: invalid,
          404: missing,
        },
      },
    },
    async (request, reply) => {
      const deleted = await repository.delete(request.params.id);
      if (!deleted) throw notFound(`Memory ${request.params.id} not found.`);
      return reply.code(204).send();
    },
  );

  done();
};

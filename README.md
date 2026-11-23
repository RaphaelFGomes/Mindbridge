# Mindbridge

[![CI](https://github.com/RaphaelFGomes/Mindbridge/actions/workflows/ci.yml/badge.svg)](https://github.com/RaphaelFGomes/Mindbridge/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/RaphaelFGomes/Mindbridge/graph/badge.svg)](https://codecov.io/gh/RaphaelFGomes/Mindbridge)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Vendor-agnostic shared memory for AI assistants.** Save context, decisions and
session handoffs once, then resume in Claude, Copilot, ChatGPT or Cursor via MCP,
REST API or CLI.

Mindbridge is also a **QA showcase**: every layer is covered by tests that run in CI.

> **Status:** v0.1 in progress — REST API, database and the first test layers.

## Why

Assistants forget everything between tools. When one runs out of tokens, you
re-explain the project to the next one. Mindbridge keeps a single, typed memory
store that every assistant can read and write:

| Type        | Holds                                    | Example                             |
| ----------- | ---------------------------------------- | ----------------------------------- |
| `user`      | Who you are, your expertise, preferences | "Prefers concise answers"           |
| `feedback`  | How the assistant should work            | "Use pnpm, never npm"               |
| `project`   | Ongoing work, goals, constraints         | "Deploy freeze until the 2nd"       |
| `reference` | Pointers to external resources           | "Runbook lives in the wiki under X" |

One fact per memory. Memories are scoped to a project (a normalized git remote such
as `github.com/acme/widgets`) or global.

## Architecture

```text
Claude Code ─┐                  ┌─ REST API (Fastify + Zod) ─┐
Copilot ─────┼── MCP (v0.2) ────┤                            ├── PostgreSQL + pgvector
Cursor ──────┤                  └─ CLI (v1.0) ───────────────┘
ChatGPT ─────┘  (remote MCP + OAuth, v1.0)
```

| Layer    | Tool                                                  |
| -------- | ----------------------------------------------------- |
| Monorepo | pnpm workspaces + Turborepo, TypeScript               |
| API      | Fastify + Zod, OpenAPI generated from the schemas     |
| Database | PostgreSQL + pgvector + Drizzle ORM                   |
| MCP      | `@modelcontextprotocol/sdk` (stdio + Streamable HTTP) |
| Web      | Next.js + shadcn/ui                                   |
| CLI      | Node, published to npm                                |

## Getting started

Requirements: Node 26+, pnpm 12+, Docker.

```bash
pnpm install
pnpm db:up                         # Postgres + pgvector on localhost:5432
cp apps/api/.env.example apps/api/.env
pnpm db:migrate
pnpm dev                           # API on http://127.0.0.1:4000
```

- Interactive docs: <http://127.0.0.1:4000/docs>
- OpenAPI document: <http://127.0.0.1:4000/openapi.json>

```bash
curl -s -X POST http://127.0.0.1:4000/v1/memories \
  -H 'content-type: application/json' \
  -d '{"project":"github.com/acme/widgets","type":"feedback","name":"prefers-pnpm","description":"Use pnpm, never npm","content":"The team standardized on pnpm workspaces."}'

curl -s 'http://127.0.0.1:4000/v1/memories?project=github.com/acme/widgets'
```

## API

| Method   | Path               | Description                                                  |
| -------- | ------------------ | ------------------------------------------------------------ |
| `GET`    | `/health`          | Liveness + database check (`503` when the database is down)  |
| `POST`   | `/v1/memories`     | Create a memory (`409` if the name exists in the same scope) |
| `GET`    | `/v1/memories`     | List; filters `project`, `includeGlobal`, `type`, pagination |
| `GET`    | `/v1/memories/:id` | Get one memory                                               |
| `PATCH`  | `/v1/memories/:id` | Update `type`, `name`, `description` or `content`            |
| `DELETE` | `/v1/memories/:id` | Delete a memory                                              |

Errors use [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457)
(`application/problem+json`) with a stable `code` and field-level `errors`.

## Testing

| Type          | Tool                                                       | Status  |
| ------------- | ---------------------------------------------------------- | ------- |
| Unit          | Vitest (incl. HTTP-level tests via `app.inject`)           | ✅      |
| Integration   | Vitest + Testcontainers (real Postgres, no DB mocks)       | ✅      |
| API           | Playwright `request` + Schemathesis (OpenAPI-driven)       | ✅      |
| Contract      | Pact (Web ↔ API, CLI ↔ API)                                | Planned |
| E2E + visual  | Playwright                                                 | Planned |
| Accessibility | axe-core inside Playwright                                 | Planned |
| Performance   | k6 (load, stress, soak) with thresholds that fail CI       | Planned |
| Security      | CodeQL, Semgrep, gitleaks, Trivy, OWASP ZAP baseline       | Planned |
| Mutation      | Stryker                                                    | Planned |
| AI evals      | promptfoo — does the AI retrieve the right memory via MCP? | Planned |

```bash
pnpm test               # unit
pnpm test:integration   # integration (needs Docker)
pnpm test:coverage      # unit + integration with coverage (needs Docker)
pnpm db:up && pnpm test:api   # black-box API tests against the built server
pnpm lint && pnpm typecheck && pnpm format:check
```

The API tests treat the published OpenAPI document as the oracle: every
response in the Playwright suite is validated against `/openapi.json`
(status, media type and body schema), and Schemathesis fuzzes every operation
from the same document. To fuzz locally (needs Python + pipx, API running):

```bash
pipx run --spec schemathesis==4.34.0 schemathesis run http://127.0.0.1:4000/openapi.json --checks all
```

Coverage is measured on unit + integration tests together and uploaded to
[Codecov](https://codecov.io/gh/RaphaelFGomes/Mindbridge) (reporting only, no PR
comments). The gate lives in [`vitest.config.ts`](apps/api/vitest.config.ts): CI
fails when coverage drops below its thresholds.

CI also fails when the Drizzle schema changes without a matching migration.

## Roadmap

- **v0.1** — API + database + unit/integration/API tests + CI
- **v0.2** — local MCP server (Claude Code and Copilot can connect)
- **v0.3** — Web UI + E2E + accessibility + visual
- **v0.4** — k6 + security pipeline + mutation testing
- **v1.0** — deploy (remote MCP with OAuth → ChatGPT) + CLI on npm

## License

[MIT](LICENSE)

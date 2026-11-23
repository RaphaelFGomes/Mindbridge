# Mindbridge — Agent Context

This file is the shared context for any AI assistant working on this repo
(Claude Code, GitHub Copilot, Cursor, Codex, Gemini CLI...). Read it first.

## What Mindbridge is

Vendor-agnostic shared memory for AI assistants. A user saves context,
decisions and session handoffs once, then resumes the same work in another
tool (e.g. Claude runs out of tokens → continue in Copilot or ChatGPT).

The repo is also a **QA portfolio showcase**: every layer must be covered by
best-in-class testing (API, E2E, contract, performance, security,
accessibility, mutation, AI evals) running in CI.

GitHub description:

> Vendor-agnostic shared memory for AI assistants. Save context, decisions and
> session handoffs once, then resume in Claude, Copilot, ChatGPT or Cursor via
> MCP, REST API or CLI. Built as a QA showcase: API, E2E, contract,
> performance, security and accessibility testing in CI.

## Core design decisions

- **MCP is the core integration.** An MCP server (`@modelcontextprotocol/sdk`)
  lets Claude Code, Copilot (VS Code agent mode), Cursor, Gemini CLI and
  ChatGPT read/write the same memory. Support both transports: stdio (local)
  and Streamable HTTP (remote).
- **ChatGPT only accepts remote MCP (HTTP + OAuth)**, so deployment and auth
  are in scope, not an afterthought.
- **Fallbacks for tools without MCP:**
  - `mindbridge handoff` — prints a "handoff card" (goal, current state,
    decisions, next steps, files touched) ready to paste into any chat.
  - `mindbridge export` — generates `AGENTS.md`, `CLAUDE.md`,
    `.github/copilot-instructions.md` and `.cursor/rules` from the same source.
- **Memory model:** typed memories (`user` / `feedback` / `project` /
  `reference`), one fact per memory, plus an index. Scoped per project
  (detected from `git remote`).

## Stack

| Layer    | Tool                                                  |
| -------- | ----------------------------------------------------- |
| Monorepo | pnpm workspaces + Turborepo, TypeScript               |
| API      | Fastify + Zod, OpenAPI generated from schemas         |
| Database | PostgreSQL + pgvector (semantic search) + Drizzle     |
| MCP      | `@modelcontextprotocol/sdk` (stdio + Streamable HTTP) |
| Web      | Next.js + shadcn/ui                                   |
| CLI      | Node, published to npm                                |

## QA strategy

| Type          | Tool                                                       |
| ------------- | ---------------------------------------------------------- |
| Unit          | Vitest                                                     |
| Integration   | Testcontainers (real Postgres, no DB mocks)                |
| API           | Playwright `request` + Schemathesis (OpenAPI-driven)       |
| Contract      | Pact (Web ↔ API, CLI ↔ API)                                |
| E2E + visual  | Playwright                                                 |
| Accessibility | axe-core inside Playwright                                 |
| Performance   | k6 (load, stress, soak) with thresholds that fail CI       |
| Security      | CodeQL, Semgrep, gitleaks, Trivy, OWASP ZAP baseline       |
| Mutation      | Stryker                                                    |
| AI evals      | promptfoo — does the AI retrieve the right memory via MCP? |
| Reporting     | Allure on GitHub Pages, Codecov, SonarCloud                |

## Backlog ideas

1. Secret redaction before saving (API keys, tokens) — also a security test target.
2. Memory staleness: "last verified" date + warning on old memories.
3. Per-memory version history and conflict resolution when two assistants
   write concurrently (concurrency test scenarios).
4. Observability: OpenTelemetry + Grafana.
5. Browser extension for ChatGPT web / Claude.ai (later phase).

## Roadmap

- **v0.1** — API + database + unit/integration/API tests + CI
- **v0.2** — local MCP server (Claude Code and Copilot can connect)
- **v0.3** — Web UI + E2E + accessibility + visual
- **v0.4** — k6 + security pipeline + mutation testing
- **v1.0** — deploy (remote MCP with OAuth → ChatGPT) + CLI on npm

## Repo layout & commands

```text
apps/api/                 Fastify REST API
  src/app.ts              buildApp({ db }) — testable app factory, no listen()
  src/server.ts           entrypoint (config, DB pool, graceful shutdown)
  src/db/schema.ts        Drizzle schema — source of truth for migrations
  src/modules/memories/   Zod schemas, repository, routes
  src/**/*.test.ts        unit tests (no database)
  test/integration/       Testcontainers tests (real Postgres)
  drizzle/                generated SQL migrations — never edit by hand
tests/api/                Black-box API tests (Playwright `request`)
  support/contract.ts     OpenAPI oracle: every response checked against /openapi.json
  fixtures.ts             per-test unique project key + auto-cleanup
```

| Command                                              | What it does                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm db:up`                                         | Start Postgres + pgvector (Docker Compose)                                                  |
| `pnpm db:migrate`                                    | Apply migrations (reads `apps/api/.env`)                                                    |
| `pnpm dev`                                           | API with reload on <http://127.0.0.1:4000>                                                  |
| `pnpm test`                                          | Unit tests                                                                                  |
| `pnpm test:integration`                              | Integration tests (needs Docker, starts its own DB)                                         |
| `pnpm test:api`                                      | Playwright API tests (needs `pnpm db:up`; starts the built API on :4010, or uses `API_URL`) |
| `pnpm lint` / `pnpm typecheck` / `pnpm format:check` | Static checks                                                                               |
| `pnpm --filter @mindbridge/api db:generate`          | New migration after a schema change                                                         |

## Conventions

- **Versions:** Node 26, pnpm 12, TypeScript 6.0 (not 7: typescript-eslint
  requires `<6.1`), Drizzle 0.45 (1.0 still RC), Zod 4, Fastify 5.
- **ESM + `nodenext`:** relative imports use the `.js` extension.
- **Validation:** Zod schemas are the single source for request validation,
  response serialization and the OpenAPI document (`/openapi.json`, `/docs`).
- **Errors:** RFC 9457 `application/problem+json` with a stable `code`
  (`VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `ROUTE_NOT_FOUND`,
  `METHOD_NOT_ALLOWED`, ...). Error responses are documented with that media
  type. Undeclared methods on a known path get 405 + `Allow`; no implicit HEAD.
- **Spec = behaviour:** anything the API accepts or rejects must be visible in
  the generated JSON Schema, because Schemathesis treats the spec as the
  oracle. Zod `refine`/`transform` are invisible there, so mirror them
  (`.meta({ minProperties })`, regex patterns, strict query integers).
- **Memory scope:** `project` is a normalized git remote
  (`github.com/acme/widgets`) or `null` for global. `name` is kebab-case and
  unique per scope (`UNIQUE NULLS NOT DISTINCT`).
- **Tests:** unit tests may use `app.inject` for anything answered before a
  query runs (validation, routing, OpenAPI). Anything touching data is an
  integration test against real Postgres — no DB mocks. Integration files run
  sequentially and truncate between tests. API tests (`tests/api`) are
  black-box: HTTP only, never import from `apps/api`, isolate data with a
  unique project key per test and run fully parallel.
- **Supply chain:** dependency build scripts are denied by default
  (`allowBuilds` in `pnpm-workspace.yaml`); approve only with a reason.
- **CI** fails if the Drizzle schema changed without a generated migration.

## Current status

- 2026-11-22: GitHub repo created (`RaphaelFGomes/Mindbridge`, public).
- 2026-11-22: v0.1 scaffold done and CI green on GitHub — monorepo,
  memories CRUD API, Postgres + Drizzle migration, OpenAPI, unit +
  Testcontainers integration tests. Dependabot enabled (TypeScript majors
  ignored).
- 2026-11-22: API test layer added — 26 Playwright black-box tests with an
  OpenAPI contract oracle, Schemathesis 4.34 fuzzing in CI (pipx, no PR
  comments), spec/behaviour gaps fixed (problem+json media type, PATCH
  `minProperties`, blank/NUL text, strict query integers, 405 + `Allow`).
- **Next steps (rest of v0.1):**
  1. Push and confirm the new `api` CI job is green; triage any Schemathesis
     findings.
  2. Coverage (Vitest v8) + Codecov.
  3. API key auth before anything is exposed remotely.

## Working rules

- This is a **personal, public** repo. Never use data from the owner's
  employer (internal names, tickets, hostnames) in fixtures or examples —
  fictional data only.
- Never `git commit`, `git push` or open pull requests; the owner does all
  three. Leave changes uncommitted for review.
- Ask the owner before adding automation that opens PRs, pushes or comments
  on its own (Dependabot version updates, Renovate, bots, such workflows).
- Repo content (code, docs, commits) in English.

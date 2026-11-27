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
6. Record which API key (i.e. which assistant) created or last changed each
   memory — the auth layer already knows `request.apiKey`.

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
apps/mcp/                 MCP server (stdio), a client of the REST API
  src/server.ts           tools: memory_index, get/save/update/delete_memory
  src/git-remote.ts       project key from `git remote get-url origin`
apps/web/                 Next.js 16 web UI (App Router, server-side API calls)
  src/proxy.ts            redirects to /login without a session cookie
  src/lib/session.ts      API key in an httpOnly cookie (server-only)
  src/lib/*.ts            pure logic (filters, form mapping, safe redirects) — unit tested
packages/api-client/      Typed REST client shared by MCP and web
  src/generated/api.ts    types generated from apps/api/openapi.json — never edit
tests/api/                Black-box API tests (Playwright `request`) + MCP over stdio
tests/e2e/                Browser E2E (Playwright): flows, axe-core, no-JavaScript project
  support/contract.ts     OpenAPI oracle: every response checked against /openapi.json
  fixtures.ts             per-test unique project key + auto-cleanup
```

| Command                                                                                             | What it does                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm db:up`                                                                                        | Start Postgres + pgvector (Docker Compose)                                                                                                                                    |
| `pnpm db:migrate`                                                                                   | Apply migrations (reads `apps/api/.env`)                                                                                                                                      |
| `pnpm dev`                                                                                          | API on :4000 + web UI on <http://127.0.0.1:3000>                                                                                                                              |
| `pnpm test`                                                                                         | Unit tests                                                                                                                                                                    |
| `pnpm test:integration`                                                                             | Integration tests (needs Docker, starts its own DB)                                                                                                                           |
| `pnpm test:api`                                                                                     | Playwright API tests (needs `pnpm db:up`; starts the built API on :4010, or uses `API_URL`)                                                                                   |
| `pnpm test:coverage`                                                                                | Unit + integration with coverage + thresholds (needs Docker)                                                                                                                  |
| `pnpm --filter @mindbridge/api openapi:export` then `pnpm --filter @mindbridge/api-client generate` | After an API change: refresh `openapi.json` and the client types (CI fails if stale)                                                                                          |
| `pnpm test:e2e`                                                                                     | Browser E2E + accessibility (needs `pnpm db:up`; builds and starts API :4011 + web :3011)                                                                                     |
| `pnpm visual:browser` then `pnpm test:visual`                                                       | Visual snapshots; the browser runs in the official Playwright container (`-- --update-snapshots` to accept an intended change, then commit `tests/e2e/specs/__screenshots__`) |
| `pnpm keys:create --name <n>` / `keys:list` / `keys:revoke <n>`                                     | Manage API keys (plaintext shown once)                                                                                                                                        |
| `pnpm lint` / `pnpm typecheck` / `pnpm format:check`                                                | Static checks                                                                                                                                                                 |
| `pnpm --filter @mindbridge/api db:generate`                                                         | New migration after a schema change                                                                                                                                           |

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
- **Auth:** `/v1/*` requires `Authorization: Bearer mb_…`, checked in an
  `onRequest` hook of the `/v1` scope (before validation). Keys live in
  `api_keys` as SHA-256 hashes, one per assistant, revocable; `/health`,
  `/docs`, `/openapi.json` stay public. Unit tests inject an in-memory
  `ApiKeyStore`; integration tests use real keys (`ctx.inject` adds one);
  API tests get a throwaway key from global setup (or `MINDBRIDGE_API_KEY`).
- **MCP server:** never write to stdout (it carries the protocol); ESLint
  allows only `console.error` in `apps/mcp/src`. The server talks to the API
  over HTTP with an API key — it never touches the database. Its HTTP client is
  typed from the generated OpenAPI types, and a compile-time assertion keeps
  its zod output schema equal to the contract. Tool errors are returned as
  `isError` results with a recovery hint, not thrown.
- **Workspace packages** export a `@mindbridge/source` condition pointing at
  `src/index.ts`: typecheck, lint (tsconfig `customConditions`) and Vitest
  (`ssr.resolve.conditions`) use the source, while `tsconfig.build.json`
  resets `customConditions` so builds and runtime use `dist`.
- **Web UI:** every API call happens on the Next.js server (`withApi`),
  never in the browser; modules touching the key import `server-only`. Pages
  type `params`/`searchParams` explicitly (no generated `PageProps`), so lint
  and typecheck don't need a prior build. Forms post to Server Actions and work
  without JavaScript; API problems map onto fields (`toFormState`). Dates are
  rendered in UTC/en-US so pages (and screenshots) are deterministic. Login
  redirects only to same-origin paths (`safeNextPath`). Optional local shortcut:
  `MINDBRIDGE_API_KEY` in `apps/web/.env.local` skips the login (the cookie
  still wins when present); the dev/start servers bind to 127.0.0.1 for that
  reason. Port via `WEB_PORT` (default 3000).
- **Sandbox note:** Turbopack's PostCSS worker binds a local port, which the
  owner's assistant sandbox blocks; verify there with `next build --webpack`.
  The project itself builds with Turbopack (default).
- **E2E:** seed data through the API (fast), exercise behaviour through the
  UI. Each test gets a unique project; sign-in happens once in the `setup`
  project and is reused via `storageState` (`tests/e2e/.auth/`, git-ignored:
  it holds a key). Locate by role/label (`exact: true` for short labels), as a
  user would. Every page state runs through `expectAccessible` (axe, WCAG 2.2
  A/AA). The web server under test gets `MINDBRIDGE_API_KEY=''` so a local
  `.env.local` shortcut can't skip the login flow being tested.
- **Visual tests:** screenshots only come from the containerized browser
  (`connectOptions` + `exposeNetwork: '<loopback>'`), never a local one, so
  baselines are byte-for-byte reproducible on macOS and CI. The container tag
  is read from the installed `@playwright/test`. Mask anything that changes per
  run (dates, project keys); keep seeded names fixed. Update baselines only for
  intended UI changes, and review the PNG diffs before committing.
- **Coverage:** the gate is `coverage.thresholds` in `apps/api/vitest.config.ts`
  (unit + integration combined). Codecov is reporting only: uploaded via OIDC
  (no token secret), `comment: false`, informational statuses. Raise the
  thresholds when coverage goes up; never lower them to make CI pass.
- **CI** fails if the Drizzle schema changed without a generated migration.

## Current status

- 2026-11-22: GitHub repo created (`RaphaelFGomes/Mindbridge`, public).
- 2026-11-22: v0.1 scaffold done and CI green on GitHub — monorepo,
  memories CRUD API, Postgres + Drizzle migration, OpenAPI, unit +
  Testcontainers integration tests. Dependabot enabled (TypeScript majors
  ignored).
- 2026-11-22: API test layer added and green in CI — 26 Playwright
  black-box tests with an OpenAPI contract oracle, Schemathesis 4.34 fuzzing
  (pipx, no PR comments). Spec/behaviour gaps fixed up front (problem+json
  media type, PATCH `minProperties`, blank/NUL text, strict query integers,
  405 + `Allow`). Schemathesis's first run found one real bug: QUERY without
  `Content-Type` got 400 instead of 405 (fixed by answering 405 in
  `onRequest`).
- 2026-11-23: Coverage added — Vitest v8 on unit + integration combined
  (98% statements, 90% branches, 100% functions, 98% lines), thresholds as a
  ratchet, uploaded to Codecov via OIDC (no PR comments, informational
  statuses). New tests: 500 problem without leaking DB details, migrations
  re-runnable without data loss.
- 2026-11-23: API key auth added — per-assistant keys hashed in Postgres,
  CLI to create/list/revoke, 401 + `WWW-Authenticate` before validation,
  bearer scheme documented in OpenAPI (Schemathesis now runs authenticated
  and checks `ignored_auth`). This completes the v0.1 scope.
- 2026-11-25: v0.2 MCP server (stdio) — 5 tools, project detection from the
  git remote, HTTP client typed from the committed OpenAPI document (CI checks
  `openapi.json` and the generated types are current), unit tests through the
  in-memory MCP transport and end-to-end tests spawning the real binary over
  stdio against the real API. Coverage for `apps/mcp` uploaded to Codecov.
- 2026-11-26: Dogfooding works — Claude Code (user scope) saved and recalled a
  global memory through the MCP server against a local API. Behind a proxy,
  the MCP server needs `NODE_USE_ENV_PROXY=1` (documented in README).
- 2026-11-26: v0.3 started. Increment 1 done: `packages/api-client` (typed
  client shared by MCP and web, `list()` for paged results).
- **v0.3 decisions:** Web UI = Next.js 16 + Tailwind 4 + hand-written
  shadcn/ui-style components (the shadcn registry is unreachable from the
  owner's sandbox). Login = paste an API key; the Next.js server keeps it in an
  httpOnly, SameSite=Strict cookie and makes every API call server-side (the
  browser never sees the key). Key management stays in the CLI.
- 2026-11-26: v0.3 increment 2 — `apps/web`: login with an API key,
  memories list (project/type/global filters, pagination), view, create, edit,
  delete with a confirmation dialog; unit tests for the pure logic. MCP now
  hints "Is the API running?" on 502/503/504 too (found while dogfooding).
- 2026-11-26: v0.3 increment 3a — `tests/e2e`: 26 browser tests (auth and
  cookie flags, open-redirect guard, revoked-key session end, CRUD, form
  regression, delete dialog keyboard behaviour, pagination, 404, skip link,
  no-JavaScript project) and axe-core on every page and state.
- 2026-11-26: v0.3 increment 3b — visual snapshots of every page (desktop +
  Pixel 7) with the browser in the official Playwright container; header now
  wraps on narrow screens.
- **Next steps (v0.3):**
  1. Generate and commit the first baselines locally; confirm CI matches them.
  2. Close v0.3 (README roadmap), then plan v0.4 (k6, security pipeline,
     mutation testing).

## Working rules

- This is a **personal, public** repo. Never use data from the owner's
  employer (internal names, tickets, hostnames) in fixtures or examples —
  fictional data only.
- Never `git commit`, `git push` or open pull requests; the owner does all
  three. Leave changes uncommitted for review.
- Ask the owner before adding automation that opens PRs, pushes or comments
  on its own (Dependabot version updates, Renovate, bots, such workflows).
- Repo content (code, docs, commits) in English.

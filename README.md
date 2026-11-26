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
Claude Code ─┐
Copilot ─────┼── MCP server ─┐
Cursor ──────┘               ├── REST API (Fastify + Zod) ── PostgreSQL + pgvector
Browser ───── Web UI ────────┤
                 CLI (v1.0) ─┘   ChatGPT: remote MCP + OAuth (v1.0)
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
pnpm keys:create --name my-laptop  # prints an API key once: store it
pnpm dev                           # API on :4000, web UI on http://127.0.0.1:3000
```

- Interactive docs: <http://127.0.0.1:4000/docs>
- OpenAPI document: <http://127.0.0.1:4000/openapi.json>

```bash
export MINDBRIDGE_API_KEY=mb_...   # from keys:create

curl -s -X POST http://127.0.0.1:4000/v1/memories \
  -H "authorization: Bearer $MINDBRIDGE_API_KEY" \
  -H 'content-type: application/json' \
  -d '{"project":"github.com/acme/widgets","type":"feedback","name":"prefers-pnpm","description":"Use pnpm, never npm","content":"The team standardized on pnpm workspaces."}'

curl -s 'http://127.0.0.1:4000/v1/memories?project=github.com/acme/widgets' \
  -H "authorization: Bearer $MINDBRIDGE_API_KEY"
```

## Authentication

Every `/v1` route requires `Authorization: Bearer <key>`; `/health`, `/docs` and
`/openapi.json` are public. Create one key per assistant or machine, so each can
be revoked on its own:

```bash
pnpm keys:create --name claude-code   # shown once
pnpm keys:list                        # name, prefix, last used, status (never the key)
pnpm keys:revoke claude-code          # effective immediately
```

Keys look like `mb_` + 43 base64url characters (256 random bits). The fixed
prefix lets secret scanners spot leaked keys. Only a SHA-256 hash is stored: a
fast hash is enough for high-entropy keys (bcrypt or argon2 exist to protect
low-entropy passwords). Missing or invalid keys get a `401` with
`WWW-Authenticate: Bearer` before any input is validated.

## Web UI

`pnpm dev` also starts the web app on <http://127.0.0.1:3000>: browse memories by
project and type, read, create, edit and delete them. Sign in with an API key
(`pnpm keys:create --name web`): the Next.js server keeps it in an httpOnly,
SameSite=Strict cookie and makes every API call itself, so the browser never
sees the key. Forms work without JavaScript, and every page is checked with
axe-core.

Tired of pasting the key locally? Put `MINDBRIDGE_API_KEY=mb_...` in
`apps/web/.env.local` (git-ignored) and the login page is skipped. The dev server
only listens on 127.0.0.1; never set it on a server others can reach. Port 3000
taken? `WEB_PORT=3001 pnpm dev`.

## Connect your assistant (MCP)

The MCP server (`apps/mcp`) is a thin client of the REST API: each assistant gets
its own API key, and memories are scoped to the git repository the assistant is
working in (detected from `git remote get-url origin`, so SSH and HTTPS clones
share memories).

```bash
pnpm --filter @mindbridge/mcp build
pnpm keys:create --name claude-code     # one key per assistant
```

**Claude Code**

```bash
claude mcp add --transport stdio mindbridge --scope user \
  --env MINDBRIDGE_API_URL=http://127.0.0.1:4000 \
  --env MINDBRIDGE_API_KEY=mb_... \
  -- node /absolute/path/to/Mindbridge/apps/mcp/dist/index.js
```

**VS Code (Copilot agent mode)**: `.vscode/mcp.json` (the key is prompted for, never stored in the file)

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "mindbridge-key",
      "description": "Mindbridge API key",
      "password": true
    }
  ],
  "servers": {
    "mindbridge": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/Mindbridge/apps/mcp/dist/index.js"],
      "cwd": "${workspaceFolder}",
      "env": {
        "MINDBRIDGE_API_URL": "http://127.0.0.1:4000",
        "MINDBRIDGE_API_KEY": "${input:mindbridge-key}"
      }
    }
  }
}
```

Other MCP clients (Cursor, Gemini CLI...) take the same command and environment.
If a client does not start the server in your repository, set `MINDBRIDGE_PROJECT`
(e.g. `github.com/acme/widgets`).

**Behind an HTTP proxy?** Node's `fetch` ignores `HTTP(S)_PROXY` unless
`NODE_USE_ENV_PROXY=1` is set (Node 24+). If the server reports the API as
unreachable while `curl` works, add `NODE_USE_ENV_PROXY=1` to its environment
(e.g. `--env NODE_USE_ENV_PROXY=1`).

| Tool            | What it does                                                     |
| --------------- | ---------------------------------------------------------------- |
| `memory_index`  | One line per memory (this project + global): call it first       |
| `get_memory`    | Read one memory in full                                          |
| `save_memory`   | Save one fact, scoped to the project (default) or global         |
| `update_memory` | Change type, name, description or content                        |
| `delete_memory` | Delete a memory (marked destructive, so clients ask for consent) |

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

| Type          | Tool                                                             | Status  |
| ------------- | ---------------------------------------------------------------- | ------- |
| Unit          | Vitest (incl. HTTP-level tests via `app.inject`)                 | ✅      |
| Integration   | Vitest + Testcontainers (real Postgres, no DB mocks)             | ✅      |
| API           | Playwright `request` + Schemathesis (OpenAPI-driven)             | ✅      |
| Contract      | Pact (Web ↔ API, CLI ↔ API)                                      | Planned |
| E2E + visual  | Playwright                                                       | Planned |
| Accessibility | axe-core inside Playwright                                       | Planned |
| Performance   | k6 (load, stress, soak) with thresholds that fail CI             | Planned |
| Security      | CodeQL, Semgrep, gitleaks, Trivy, OWASP ZAP baseline             | Planned |
| Mutation      | Stryker                                                          | Planned |
| MCP           | Vitest + in-memory MCP transport; stdio end-to-end in Playwright | ✅      |
| AI evals      | promptfoo — does the AI retrieve the right memory via MCP?       | Planned |

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

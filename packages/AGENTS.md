# Packages

Monorepo packages containing production code.

## Structure

- `shared/` — Common code: BullMQ queue, types, API utilities, workspace management
- `webhook/` — HTTP server receiving webhooks, enqueues jobs to Redis, serves dashboard and sessions API
- `worker/` — BullMQ worker processing jobs via Claude Code CLI + MCP servers, with session persistence
- `dashboard/` — React SPA for queue monitoring, job creation, and session management

## Development

When adding a new package, update the root `package.json` with a `--filter` script.

Do not alias scripts that are already in the package unnecessarily.

Keep code files short and use folders to organize related files.

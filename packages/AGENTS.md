# Packages

Monorepo packages containing production code.

## Structure

- `shared/` — Common code: BullMQ queue, types, API utilities
- `webhook/` — HTTP server receiving webhooks, enqueues jobs to Redis
- `worker/` — BullMQ worker processing jobs via Claude Code CLI + MCP servers

## Development

When adding a new package, update the root `package.json` with a `--filter` script.

Do not alias scripts that are already in the package unnecessarily.

Keep code files short and use folders to organize related files.

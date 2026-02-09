# Worker

BullMQ worker that spawns Claude Code CLI to process jobs.

## Patterns

- Worker orchestrates, Claude does the work — keep worker logic minimal
- Prompt templates in `instructions/` use `{{placeholder}}` syntax
- MCP servers configured in `mcp-config.json`, not hardcoded

## Session Persistence

- Workspaces are **not** cleaned up after job completion — they persist for session reuse
- On follow-up jobs, the worker uses `--continue` to resume the previous Claude conversation
- Cleanup happens on PR merge (GitHub webhook) or manually (sessions API)
- The worker also handles `SessionCleanupJob` queue messages alongside regular jobs

## Gotchas

- `--dangerously-skip-permissions` required for non-interactive CLI usage
- Workspaces persist after jobs — cleanup is triggered by PR merge or manual deletion, not job completion
- Post error comments on failure so users know what happened

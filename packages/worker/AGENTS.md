# Worker

BullMQ worker that spawns Claude Code CLI to process jobs.

## Patterns

- Worker orchestrates, Claude does the work — keep worker logic minimal
- Prompt templates in `instructions/` use `{{placeholder}}` syntax
- MCP servers configured in `mcp-config.json`, not hardcoded

## Session Persistence

- Workspaces are **not** cleaned up after job completion — they persist for session reuse
- On follow-up jobs, the worker uses `--continue` to resume the previous Claude conversation
- Inactive sessions are pruned periodically via `setInterval` (configurable threshold and interval)
- At soft cap (`maxSessions`, configured via dashboard), the oldest session is evicted (LRU) to make room for new ones

## Gotchas

- `--dangerously-skip-permissions` required for non-interactive CLI usage
- Workspaces persist after jobs — cleanup is via periodic pruning or manual deletion, not job completion
- Post error comments on failure so users know what happened

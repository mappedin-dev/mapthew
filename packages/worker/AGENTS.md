# Worker

BullMQ worker that spawns Claude Code CLI to process jobs.

## Patterns

- Worker orchestrates, Claude does the work — keep worker logic minimal
- Prompt templates in `instructions/` use `{{placeholder}}` syntax
- MCP servers configured in `mcp-config.json`, not hardcoded

## Gotchas

- `--dangerously-skip-permissions` required for non-interactive CLI usage
- Temp workspaces must be cleaned up in finally block (success or failure)
- Post error comments on failure so users know what happened

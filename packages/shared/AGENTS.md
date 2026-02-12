# Shared Package

Code shared between other packages.

## Exporting Code

Avoid barrel files. To export code from a new file, add a new entry point in the package.json.

## Config

`src/config.ts` contains code that instantiates `ioredis`.

Front end packages should avoid importing from this file. Any code needed by front end packages should not be put in this file.

## Workspace

`src/workspace.ts` manages persistent workspaces and Claude session tracking.

- Workspaces live at `WORKSPACES_DIR/{issueKey}` (default `/tmp/{botName}-workspaces/{issueKey}`)
- Claude CLI sessions live at `~/.claude/projects/{encoded-path}` (path with `/` replaced by `-`)
- `getSessionCount()` counts workspaces that have a matching Claude session directory
- `validateIssueKey()` guards all workspace operations against path traversal
- `cleanupWorkspace()` removes both the workspace dir and the Claude session dir
- `maxSessions` (dashboard config, default 20) is a soft cap; the worker evicts the oldest session (LRU) when exceeded
- `pruneInactiveSessions()` removes sessions older than a configurable threshold

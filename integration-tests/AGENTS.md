# Integration Tests

Test files that do not belong within packages as unit tests.

## Structure

- `/mcp` - MCP server integration tests against real external services.
- `/e2e` - End-to-end integration test of the pipeline.

## Running

From the root:

```bash
pnpm mcp-test          # Run all MCP integration tests
pnpm mcp-test:github   # GitHub MCP only
pnpm mcp-test:jira     # JIRA MCP only
```

Note: `pnpm test` runs unit tests only. Integration tests must be run separately.

## MCP

### Adding a Test

1. Create `mcp/tests/<name>.ts` exporting `test<Name>(): Promise<boolean>`
2. Use `RemoteMcpClient` (HTTP) or `LocalMcpClient` (stdio) from `utils/clients.ts`
3. Register in `mcp/index.ts` (import, add to `tests` and `names` records)

### Constraints

- Tests must be idempotent — prefer read-only operations (list, search, get)
- Handle missing credentials gracefully with clear error messages

## E2E

TODO

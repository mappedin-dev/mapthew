# Integration Tests

Test files that do not belong within packages as unit tests.

## Structure

- `/mcp` - MCP server integration tests against real external services.
- `/e2e` - End-to-end integration test of the pipeline.

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

# 🤓 Dexter

Your AI-powered intern that turns JIRA tickets into pull requests. Mention `@dexter` in a JIRA comment with an instruction, and it will read the ticket, make code changes, and open a PR on GitHub.

## Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- [pnpm](https://pnpm.io/) (v9.15+)

## Credentials

| Credential            | Purpose                              |
| --------------------- | ------------------------------------ |
| **JIRA API Token**    | Reading tickets and posting comments |
| **GitHub PAT**        | `repo` and `workflow` scopes         |
| **Anthropic API Key** | Claude Code CLI                      |

## Setup

1. Clone the repository and install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the example environment file and fill in your credentials:

   ```bash
   cp .env.example .env
   ```

3. Start the services:

   ```bash
   pnpm dev
   ```

   This runs Redis, the webhook server, and the worker via Docker Compose.

4. Expose the webhook server (defaults to `:3000`) to the internet and configure your JIRA webhook to point to it.

## Local Testing

Use the `requests.http` file to trigger workflows without relying on the JIRA webhook:

1. Make sure the services are running
2. Open `requests.http` in VS Code with the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension
3. Click "Send Request" above any request to trigger it

## Integration Tests

To run `pnpm mcp test` locally, install the JIRA MCP server:

```bash
pipx install mcp-atlassian
```

The GitHub MCP test uses a remote hosted endpoint and requires no local installation.

Run integration tests to make sure the MCP servers are accessible:

```bash
pnpm mcp test
```

## Architecture

See [docs/architecture.md](./docs/architecture.md) for detailed system design and workflow diagrams.

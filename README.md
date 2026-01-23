# 🤓 Dexter

Your AI-powered intern that turns JIRA tickets into pull requests. Mention `@dexter` in a JIRA comment with an instruction, and it will read the ticket, make code changes, and open a PR on GitHub.

## Using Dexter in JIRA

1. Navigate to any JIRA ticket
2. Add a comment mentioning `@dexter` followed by your instruction:
   ```
   @dexter implement this feature
   ```
3. Dexter will:
   - Read the ticket details (summary, description, comments, attachments)
   - Find the relevant GitHub repository
   - Create a branch and implement the requested changes
   - Open a pull request and post the link back to the ticket

### Tips

- Be specific in your instructions for better results
- Include the repository URL in your comment if Dexter can't find it automatically:
  ```
  @dexter implement this in https://github.com/org/repo
  ```
- Dexter posts progress updates as comments, so you can track its work

## Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- [pnpm](https://pnpm.io/) (v9.15+)

## Credentials

| Credential              | Purpose                              |
| ----------------------- | ------------------------------------ |
| **JIRA API Token**      | Reading tickets and posting comments |
| **JIRA Webhook Secret** | Verify webhook signatures (optional) |
| **GitHub PAT**          | `repo` and `workflow` scopes         |
| **Anthropic API Key**   | Claude Code CLI                      |

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

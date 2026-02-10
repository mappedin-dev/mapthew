# 🤓 Mapthew

Your AI-powered intern that turns JIRA tickets into pull requests. Mention `@mapthew` in a JIRA comment with an instruction, and it will read the ticket, make code changes, and open a PR on GitHub.

## Usage

### JIRA

Use Mapthew to open PRs from an existing JIRA ticket.

1. Navigate to any JIRA ticket
2. Add a comment mentioning `@mapthew` followed by your instruction:
   ```
   @mapthew implement this feature
   ```
3. Mapthew will:
   - Read the ticket details (summary, description, comments, attachments)
   - Find the relevant GitHub repository
   - Create a branch and implement the requested changes
   - Open a pull request and post the link back to the ticket

### GitHub

Use Mapthew to update an open PR in GitHub.

1. Navigate to any PR.
2. Add a comment mentioning `@mapthew` followed by your instruction:
   ```
   @mapthew please add unit tests for this feature
   ```
3. Mapthew will:
   - Read the original JIRA ticket for context
   - Review the PR and existing comments
   - Make the requested changes on the existing branch
   - Push new commits to update the PR
   - Post a summary of changes as a PR comment

### Tips and Best Practices

- Be specific in your instructions for better results
- Include the repository URL in your comment if Mapthew can't find it automatically
  ```
  @mapthew implement this in https://github.com/org/repo
  ```

## Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- [pnpm](https://pnpm.io/) (v9.15+)

## Configuration

| Variable     | Purpose                                           | Default   |
| ------------ | ------------------------------------------------- | --------- |
| **BOT_NAME** | Bot name used for triggers, branches, queue names | `mapthew` |

Set `BOT_NAME` to customize the trigger (e.g., `@mybot` instead of `@mapthew`), branch prefix, and internal identifiers.

## Credentials

| Credential                | Purpose                              | Permissions / Scopes                                                                                                                                                   |
| ------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JIRA API Token**        | Reading tickets and posting comments | Read tickets, write comments                                                                                                                                           |
| **JIRA Webhook Secret**   | Verify webhook signatures            | —                                                                                                                                                                      |
| **GitHub PAT**            | Git CLI + GitHub MCP                 | `repo`, `workflow`                                                                                                                                                     |
| **GitHub Webhook Secret** | Verify GitHub webhook signatures     | —                                                                                                                                                                      |
| **Figma API Key**         | Fetching design data from Figma      | `file_content:read`, `file_comments:read`, `file_metadata:read`, `library_assets:read`, `team_library_content:read`, `library_content:read`, `file_dev_resources:read` |
| **Anthropic API Key**     | Claude Code CLI                      | —                                                                                                                                                                      |
| **Auth0 Domain**          | Auth0 tenant for dashboard auth      | —                                                                                                                                                                      |
| **Auth0 Client ID**       | Dashboard SPA client ID              | —                                                                                                                                                                      |
| **Auth0 Audience**        | API identifier for JWT validation    | —                                                                                                                                                                      |

## Webhooks

Configure your webhooks to point to your tunnel or production URL. Make sure the webhook is configured to send a JSON payload.

### JIRA

Point to `/webhook/jira` for ticket comment triggers.

### GitHub

Point to `/webhook/github` and enable these events:

- Commit comments
- Discussion comments
- Issue comments
- Pull request review comments
- Pull requests

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

   To do a full rebuild (clears volumes and rebuilds images without cache):

   ```bash
   pnpm dev:rebuild
   ```

   Use `dev:rebuild` when you change:

   - Dependencies in `package.json`
   - Dockerfiles

4. Start a [cloudflare tunnel](#cloudflare-tunnel).

5. Configure your [webhooks](#webhooks) to point to your tunnel.

## Unit Testing

Run unit tests:

```bash
pnpm test
```

## Local Testing

Use the `requests.http` file to trigger workflows without relying on the JIRA webhook:

1. Make sure the services are running
2. Generate the webhook signature:
   ```bash
   pnpm requests:init
   ```
3. Open `requests.http` in VS Code with the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension
4. Click "Send Request" above any request to trigger it

## Cloudflare Tunnel

Use a Cloudflare tunnel to expose your local webhook server for testing with real JIRA/GitHub webhooks.

1. Get set up with a cloudflare tunnel and obtain credentials from your manager.

2. Copy the example config files and fill in your tunnel credentials:

```bash
cp cloudflare-tunnel.json.example cloudflare-tunnel.json
cp cloudflare-tunnel-config.yml.example cloudflare-tunnel-config.yml
```

3. Run the tunnel:

```bash
pnpm tunnel
```

The webhook server will be accessible at the tunnel hostname.

## MCP Integration Tests

To test the MCP servers locally, install the JIRA and Figma MCP servers:

```bash
pipx install mcp-atlassian
npm install -g figma-developer-mcp
```

The GitHub MCP test uses a remote hosted endpoint and requires no local installation.

Run integration tests to make sure the MCP servers are accessible:

```bash
pnpm mcp mcp-test
```

## Architecture

See [docs/architecture.md](./docs/architecture.md) for detailed system design and workflow diagrams.

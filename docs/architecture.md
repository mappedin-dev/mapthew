# Architecture

## Overview

### Workflow

Mapthew can be triggered from three entry points:

- **JIRA**: Comment `@mapthew` on a ticket to create a new PR
- **GitHub**: Comment `@mapthew` on an existing PR to request updates
- **Admin Dashboard**: Create a job manually with custom instructions

```mermaid
flowchart TD
    subgraph JIRA["☁️ JIRA Cloud"]
        A[👤 Developer comments<br/><code>@mapthew implement auth</code>]
    end

    subgraph GitHub["☁️ GitHub"]
        G[👤 Developer comments on PR<br/><code>@mapthew add tests</code>]
    end

    B[Webhook Server]
    ADMIN[Admin Dashboard]

    C[("BullMQ / Redis")]
    D[Workers]

    subgraph External["External Services"]
        H[GitHub API]
        I[Claude API]
        J[JIRA API]
        K[Figma API]
    end

    V[("Key Vault")]

    A -->|/webhook/jira| B
    G -->|/webhook/github| B
    ADMIN -->|POST /api/queue/jobs| B
    B -->|queue.add| C
    C -->|worker.process| D
    D -->|MCP| J
    D -->|MCP| H
    D -->|MCP| K
    D -->|generate code| I

    B -->|read/write| C
    B -->|read/write secrets| V
    D -->|read secrets| V
```

### End-to-End Example

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant JIRA
    participant System as Mapthew
    participant Figma
    participant GH as GitHub

    Note over Dev,GH: 1. Create PR from JIRA

    Dev->>JIRA: Comment "@mapthew implement this fix"
    JIRA->>System: Webhook: comment_created
    System->>System: Enqueue job
    System->>JIRA: Comment "🤓 Okie dokie!"

    System->>JIRA: Fetch ticket context
    System->>Figma: Fetch design data (if Figma link in ticket)
    System->>GH: Search repos, infer target
    System->>System: Claude generates code
    System->>GH: Push branch, create PR
    System->>JIRA: Comment "🤓 Done! github.com/..."

    Dev->>GH: Review PR

    Note over Dev,GH: 2. Request changes via GitHub

    Dev->>GH: Comment "@mapthew add unit tests"
    GH->>System: Webhook: issue_comment
    System->>System: Extract issue key from branch
    System->>System: Enqueue job
    System->>GH: Comment "🤓 Okie dokie!"

    System->>JIRA: Fetch ticket context
    System->>Figma: Fetch design data (if Figma link in ticket)
    System->>GH: Fetch PR details and comments
    System->>System: Claude generates code
    System->>GH: Push commits to branch
    System->>GH: Comment "🤓 Done! <summary>"

    Dev->>GH: Approve & merge PR
```

## Worker Internals

```mermaid
flowchart LR
    subgraph Worker
        SCRIPT["Worker Script"]
        CLI["Claude Code CLI"]
        JIRA_MCP["JIRA MCP"]
        GH_MCP["GitHub MCP"]
        FIGMA_MCP["Figma MCP"]
        GIT["Git CLI"]
    end

    SCRIPT --> CLI
    CLI --> JIRA_MCP
    CLI --> GH_MCP
    CLI --> FIGMA_MCP
    CLI --> GIT
```

- **Worker Script** — BullMQ worker, processes jobs with retries
- **Claude Code CLI** — AI agent that orchestrates the entire flow
- **JIRA MCP** — Fetches rich ticket context (description, comments, attachments, linked issues)
- **GitHub MCP** — Searches repos, creates PRs, posts comments
- **Figma MCP** — Fetches design data (layout, styling, components) from Figma files
- **Git CLI** — Clone, branch, commit, push (used by Claude)

---

### JIRA-Triggered Job (New PR)

```mermaid
sequenceDiagram
    participant BullMQ as BullMQ
    participant W as Worker
    participant Claude as Claude Code CLI
    participant JIRA_MCP as JIRA MCP
    participant Figma_MCP as Figma MCP
    participant GH_MCP as GitHub MCP

    BullMQ->>W: Job {issueKey, instruction, source: "jira"}
    Note over BullMQ: Auto-retries on failure

    W->>Claude: Execute with JIRA prompt

    Claude->>JIRA_MCP: Fetch ticket details
    Note over JIRA_MCP: Summary, description,<br/>comments, attachments
    JIRA_MCP-->>Claude: Rich ticket data

    Claude->>Figma_MCP: Fetch design data
    Note over Figma_MCP: Layout, styling,<br/>components (if Figma link)
    Figma_MCP-->>Claude: Design context

    Claude->>GH_MCP: Search repos
    Note over Claude: Infer target repo<br/>from ticket context
    GH_MCP-->>Claude: Repo list

    Claude->>Claude: git clone, create new branch
    Claude->>Claude: Read codebase, make changes
    Claude->>Claude: git add, commit, push

    Claude->>GH_MCP: Create pull request
    GH_MCP-->>Claude: PR URL

    Claude->>JIRA_MCP: Post PR link as comment

    Claude-->>W: Done
    Note over W: Workspace persisted for<br/>session reuse on follow-ups
```

### GitHub-Triggered Job (Update PR)

```mermaid
sequenceDiagram
    participant BullMQ as BullMQ
    participant W as Worker
    participant Claude as Claude Code CLI
    participant JIRA_MCP as JIRA MCP
    participant Figma_MCP as Figma MCP
    participant GH_MCP as GitHub MCP

    BullMQ->>W: Job {issueKey, instruction, source: "github", github: {...}}
    Note over BullMQ: Auto-retries on failure

    W->>Claude: Execute with GitHub prompt

    Claude->>JIRA_MCP: Fetch ticket details
    Note over JIRA_MCP: Original context from<br/>linked JIRA ticket
    JIRA_MCP-->>Claude: Rich ticket data

    Claude->>Figma_MCP: Fetch design data
    Note over Figma_MCP: Layout, styling,<br/>components (if Figma link)
    Figma_MCP-->>Claude: Design context

    Claude->>GH_MCP: Fetch PR details and comments
    Note over GH_MCP: Existing changes,<br/>review feedback
    GH_MCP-->>Claude: PR context

    Claude->>Claude: git clone, checkout existing branch
    Claude->>Claude: Read codebase, make changes
    Claude->>Claude: git add, commit, push

    Note over Claude: PR auto-updates with new commits

    Claude->>GH_MCP: Post summary comment on PR

    Claude-->>W: Done
    Note over W: Session resumed via --continue,<br/>workspace persisted
```

### Admin-Triggered Job (Manual)

```mermaid
sequenceDiagram
    participant Admin as Admin Dashboard
    participant API as Webhook Server
    participant BullMQ as BullMQ
    participant W as Worker
    participant Claude as Claude Code CLI

    Admin->>API: POST /api/queue/jobs {instruction}
    API->>BullMQ: queue.add(job)
    API-->>Admin: {success, jobId}

    BullMQ->>W: Job {instruction, source: "admin"}
    Note over BullMQ: Auto-retries on failure

    W->>Claude: Execute with instruction
    Claude->>Claude: Execute task based on instruction
    Claude-->>W: Done
    Note over W: Workspace persisted

    Note over Admin: Job status visible on dashboard
```

Admin jobs are created directly from the dashboard without external triggers. They don't post completion comments since the status is visible on the dashboard.

---

## Required Credentials

| Credential                | Purpose                            | Scope                        |
| ------------------------- | ---------------------------------- | ---------------------------- |
| **JIRA API Token**        | JIRA MCP (fetch tickets, comments) | Read tickets, write comments |
| **JIRA Webhook Secret**   | Verify JIRA webhook signatures     | Optional (for security)      |
| **GitHub PAT**            | GitHub MCP + Git CLI               | `repo`, `workflow` scopes    |
| **GitHub Webhook Secret** | Verify GitHub webhook signatures   | Optional (for security)      |
| **Figma API Key**         | Figma MCP (fetch design data)      | Read-only access             |
| **Anthropic API Key**     | Claude Code CLI access             | Enterprise tier recommended  |

> All integration secrets above are stored in **Key Vault** and managed via the dashboard. See [Secrets Management](#secrets-management) below.
> On first startup, secrets can be seeded from env vars into Key Vault; after that, the vault is the single source of truth.

---

## Secrets Management

Integration secrets (JIRA, GitHub, Figma, Anthropic) are stored in a Key Vault and managed from the admin dashboard. The application uses the Azure Key Vault REST API as a universal interface -- the same `@azure/keyvault-secrets` client code works in all environments:

- **Production:** Azure Key Vault (encrypted at rest, RBAC, audit logs) with managed identity
- **Local dev:** [Lowkey Vault](https://github.com/nagyesta/lowkey-vault) -- an open-source Azure Key Vault API-compatible emulator running as a Docker container

### Architecture

```mermaid
flowchart LR
    subgraph dashboard [Dashboard]
        UI["Settings Page"]
    end
    subgraph webhook [Webhook Server]
        API["PUT/GET/DELETE /api/secrets"]
        MW["Webhook Middleware"]
    end
    subgraph worker [Worker]
        WK["Job Processor"]
    end
    subgraph shared [Shared Package]
        SM["SecretsManager"]
        SC["Azure SecretClient"]
    end
    subgraph vault [Key Vault API]
        AKV["Azure Key Vault OR Lowkey Vault"]
    end

    UI -->|"Auth0 JWT"| API
    API --> SM
    MW --> SM
    WK --> SM
    SM --> SC
    SC --> AKV
```

`SecretsManager` (in `@mapthew/shared`) wraps `SecretClient` with a custom `VaultCredential` that authenticates via the managed identity token endpoint. Auth uses three env vars, same names in all environments:

### Environment Variables

| Variable                  | Purpose                         |
| ------------------------- | ------------------------------- |
| `AZURE_KEYVAULT_URL`      | Vault URL (required)            |
| `AZURE_IDENTITY_ENDPOINT` | Managed identity token endpoint |
| `AZURE_IDENTITY_HEADER`   | Managed identity auth header    |

### Stored Secrets

| Vault Key               | Seeded From (.env)      |
| ----------------------- | ----------------------- |
| `jira-email`            | `JIRA_EMAIL`            |
| `jira-api-token`        | `JIRA_API_TOKEN`        |
| `jira-webhook-secret`   | `JIRA_WEBHOOK_SECRET`   |
| `github-token`          | `GITHUB_TOKEN`          |
| `github-webhook-secret` | `GITHUB_WEBHOOK_SECRET` |
| `figma-api-key`         | `FIGMA_API_KEY`         |
| `anthropic-api-key`     | `ANTHROPIC_API_KEY`     |

### Startup Seed Flow

On first startup, for each managed secret: if the vault entry is empty and the corresponding env var is set, the env var value is written into the vault. After seeding, env vars are ignored -- the vault is the only source of truth.

### Read/Write Modes

- **Webhook server:** `readOnly: false` -- reads, writes, deletes, and runs seed logic
- **Worker:** `readOnly: true` -- read-only access, no seeding, no writes

### Local Dev

Lowkey Vault runs as a Docker Compose service alongside Redis. It serves HTTPS on port 8443 (vault API) and HTTP on port 8080 (token endpoint). `NODE_TLS_REJECT_UNAUTHORIZED=0` is set on webhook/worker containers for the self-signed cert.

> See [`docs/key-vault-secrets.md`](./key-vault-secrets.md) for full implementation details.

---

## Session Management

The worker uses **persistent workspaces** to reuse Claude CLI sessions across jobs for the same issue. This avoids redundant context fetching (JIRA tickets, codebases) on follow-up jobs.

```mermaid
flowchart TD
    subgraph Storage
        WORKSPACES["/tmp/mapthew-workspaces/{issueKey}"]
        CLAUDE_SESSIONS["~/.claude/projects/{encoded-path}"]
    end

    subgraph Lifecycle
        CREATE["getOrCreateWorkspace()"]
        RESUME["hasExistingSession() → --continue"]
        CLEANUP["cleanupWorkspace()"]
    end

    CREATE -->|"creates"| WORKSPACES
    RESUME -->|"checks"| CLAUDE_SESSIONS
    CLEANUP -->|"removes both"| WORKSPACES
    CLEANUP -->|"removes both"| CLAUDE_SESSIONS
```

### Key Concepts

- **Workspace**: A directory at `WORKSPACES_DIR/{issueKey}` used as the working directory for Claude CLI. Persists across jobs.
- **Claude session**: Claude CLI stores conversation history in `~/.claude/projects/{encoded-path}`. The `--continue` flag resumes the most recent conversation.
- **Session counting**: Only workspaces with a matching Claude session directory count toward `MAX_SESSIONS`.
- **Periodic pruning**: A background `setInterval` in the worker removes sessions inactive longer than `PRUNE_THRESHOLD_DAYS`. Runs every `PRUNE_INTERVAL_DAYS`.
- **Soft cap (LRU eviction)**: When creating a new workspace and the session count >= `MAX_SESSIONS`, the oldest session is evicted to make room.
- **Manual cleanup**: Sessions can be deleted via the dashboard API (`DELETE /api/sessions/:issueKey`), which calls `cleanupWorkspace()` directly.

### Environment Variables

| Variable               | Purpose                                         | Default                     |
| ---------------------- | ----------------------------------------------- | --------------------------- |
| `WORKSPACES_DIR`       | Root directory for workspaces                   | `/tmp/{botName}-workspaces` |
| `MAX_SESSIONS`         | Soft cap — oldest session evicted when exceeded | `5`                         |
| `PRUNE_THRESHOLD_DAYS` | Sessions inactive longer than this are pruned   | `7`                         |
| `PRUNE_INTERVAL_DAYS`  | How often the pruning job runs                  | `7` (weekly)                |

### Docker Volumes

| Volume               | Mount Point               | Purpose                 |
| -------------------- | ------------------------- | ----------------------- |
| `mapthew-workspaces` | `/tmp/mapthew-workspaces` | Workspace directories   |
| `claude-sessions`    | `/home/worker/.claude`    | Claude CLI session data |

---

## Admin Dashboard

The webhook server serves a custom React dashboard at `/admin` for monitoring and configuration.

**URL:** `http://localhost:3000/admin`

```mermaid
flowchart LR
    subgraph Dashboard["Admin Dashboard"]
        UI["React SPA"]
    end

    subgraph Server["Webhook Server"]
        STATIC["/admin — Static Files"]
        API_Q["/api/queues — Queue Status"]
        API_C["/api/config — Configuration"]
        API_S["/api/sessions — Session Management"]
        API_SEC["/api/secrets — Secrets Management"]
    end

    subgraph Storage
        REDIS[("Redis")]
        KV[("Key Vault")]
    end

    UI -->|fetch| API_Q
    UI -->|fetch| API_C
    UI -->|fetch| API_S
    UI -->|fetch| API_SEC
    API_Q -->|read jobs| REDIS
    API_C -->|read/write| REDIS
    API_S -->|read/cleanup| WORKSPACES[("Workspaces")]
    API_SEC -->|read/write| KV
    STATIC -->|serves| UI
```

See [`packages/dashboard/AGENTS.md`](../packages/dashboard/AGENTS.md) for detailed specs.

---

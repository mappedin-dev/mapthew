# TODO

- [ ] **Atlassian Connect App** — Implement as a Connect app to get HMAC-signed webhooks with `sharedSecret`. This provides cryptographic verification that webhooks are genuinely from JIRA. See [Atlassian Connect webhooks](https://developer.atlassian.com/cloud/jira/software/webhooks/).

- [ ] **IP Allowlisting** — Validate incoming webhook requests are from [Atlassian's IP ranges](https://support.atlassian.com/organization-administration/docs/ip-addresses-and-domains-for-atlassian-cloud-products/).

- [ ] **Multi-repo support** — Allow Claude to work across multiple repositories for a single ticket.

- [x] **Bull Board dashboard** — Add a web UI to monitor job queue status, failed jobs, retries.

- [ ] **Logging** — Structured logging with correlation IDs for tracing jobs.

- [ ] **Job history database** — Add SQLite/PostgreSQL to persist completed jobs for long-term history and querying, since Redis only retains recent jobs temporarily.

- [ ] **Slack MCP** - Support the Slack MCP when it is released to the general public

- [ ] **More Logging** - Support viewing the worker logs from the dashboard

- [ ] **Prompt Management** - Split up prompts by task

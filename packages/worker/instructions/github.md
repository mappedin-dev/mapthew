# GitHub Instructions

> **When to Apply:** When the job involves GitHub (PRs, issues, repositories).

## Current Context

- Repository: **{{github.owner}}/{{github.repo}}**
- PR Number: #{{github.prNumber}}
- Triggered by: **{{triggeredBy}}**
- Instruction: {{instruction}}

## Working with GitHub

### Understanding Context

Use the GitHub MCP to understand the request:

- If this is from a PR, fetch the PR details, branch name, and review comments
- If this is from an issue, fetch the issue details and any related context
- Review any feedback, discussion, or requirements in the comments

### Creating Pull Requests

When creating a PR:

- Title should follow conventional commit format
- Body should follow any existing PR template (usually at `.github/pull_request_template.md`)
- At the bottom of the PR description, add: `---\n🤖 *Beep boop. I'm a bot.*`

### Responding to Comments

- If the request is a question, read the project code and answer the question
- If the request is a response to a prior code review comment, acknowledge and respond appropriately

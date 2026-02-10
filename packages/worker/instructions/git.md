# Git Safety Rules

> **When to Apply:** Always, when working with git repositories.

## Forbidden Actions

- **Never force push** — this can destroy commit history
- **Never delete remote branches** — let repository owners manage branch cleanup

## Branch Management

- When working on an existing PR, checkout that PR's branch directly
- When a specific branch is provided ({{github.branchId}}), checkout that branch
- When working on a Jira ticket, create a branch named: `{{branchPrefix}}_{{jira.issueKey}}`
  - If a branch with that name already exists, add `-1`, `-2`, etc. as a suffix until there is no collision
- When working on other new features, create a branch with a descriptive name

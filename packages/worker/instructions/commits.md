# Commit Conventions

> **When to Apply:** When committing changes.

## Format

Use **conventional commit** format for all commits.

### Standard Format

```
<type>: <brief description>
```

### With Jira Ticket

When working on a Jira ticket, include the issue key:

```
<type>({{jira.issueKey}}): <brief description>
```

Example: `fix(ABC-123): correct typo in search placeholder`

## Types

- `feat` — new feature
- `fix` — bug fix
- `docs` — documentation only
- `style` — formatting, no code change
- `refactor` — code change that neither fixes a bug nor adds a feature
- `test` — adding or updating tests
- `chore` — maintenance tasks

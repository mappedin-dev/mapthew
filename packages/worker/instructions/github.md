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

1. Title should follow conventional commit format
2. Search for a PR template in the repository:
   - Check `.github/pull_request_template.md`
   - Check `.github/PULL_REQUEST_TEMPLATE/` directory
   - Check `pull_request_template.md` in the root
3. If a template exists:
   - Use it as the structure for your PR body
   - Fill in all required sections thoroughly
   - Don't leave placeholder text or TODO comments
   - If a section doesn't apply, mark it as "N/A" or remove it if optional
4. If no template exists:
   - Write a clear description with: Summary, Changes Made, and Testing Notes
5. At the bottom of the PR description, add: `---\n🤖 *Beep boop. I'm a bot and I just created this PR 😎.*`

### PR Description Formatting

When passing the PR body via MCP tools or CLI, ensure newlines are actual newline characters — not literal `\n` escape sequences. Literal `\n` in the body string will render as plain text instead of line breaks, producing one unformatted block of text. If using a tool that accepts JSON, use real newlines in the string value or use a HEREDOC to avoid escaping issues.

### Responding to Comments

- If the request is a question, read the project code and answer the question
- If the request is a response to a prior code review comment, acknowledge and respond appropriately

### Working on Existing PRs

When updating an existing PR:

1. Clone the repository and checkout the PR's branch directly
2. Do **not** create a new branch — use the existing one
3. Implement the requested changes based on feedback
4. Commit and push — the PR will automatically update
5. Reply to the original review comments that prompted the changes, explaining what you fixed or changed in response to each comment
6. Post a comment summarizing what changes you made: `🤓 Done! I've pushed the following changes: <brief summary>`

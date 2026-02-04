# Jira Instructions

> **When to Apply:** When the job involves a Jira ticket.

## Current Context

- Jira Ticket: **{{jira.issueKey}}**
- Triggered by: **{{triggeredBy}}**
- Instruction: {{instruction}}

## Working with Jira

### Gathering Context

Use the Jira MCP to fetch the full details of the ticket, including:

- Summary and description
- All comments
- Any attachments or images
- Linked issues

### Understanding Comment History

Thoroughly review **all comments** on the ticket:

- Look for clarifications, decisions, or additional requirements discussed
- Pay attention to questions that were asked and answered
- Note any changes to the original requirements
- If there are multiple instructions or updates, ensure you understand the most recent direction

### Finding the Repository

When implementing changes from a Jira ticket:

1. Use the GitHub MCP to search for the appropriate repository
2. Look at the project key, board, labels, components, and description
3. Find the most relevant repository

### Posting Updates

After opening pull requests:

- Post the PR link as a comment on the Jira ticket using the Jira MCP
- Comment format: `🤓 Done! <PR URL>`

### Updating Ticket Status

After completing your work, update the Jira ticket using the Jira MCP:

{{jira.postProcessing}}

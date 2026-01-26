/**
 * Source of the job trigger
 */
export type JobSource = "jira" | "github";

/**
 * GitHub context for PR-triggered jobs
 */
export interface GitHubContext {
  owner: string;
  repo: string;
  prNumber: number;
  commentId: number;
  branch: string;
}

/**
 * Job data stored in the queue
 */
export interface Job {
  issueKey: string;
  instruction: string;
  triggeredBy: string;
  source: JobSource;
  github?: GitHubContext;
}

/**
 * JIRA webhook payload for comment_created event
 * Minimal payload - MCP fetches full ticket details
 */
export interface WebhookPayload {
  webhookEvent: string;
  comment: {
    body: string;
    author: {
      displayName: string;
    };
  };
  issue: {
    key: string;
  };
}

/**
 * Check if a webhook payload is a comment_created event
 */
export function isCommentCreatedEvent(payload: WebhookPayload): boolean {
  return payload.webhookEvent === "comment_created";
}

/**
 * Extract @dexter instruction from comment body
 * Returns null if no @dexter trigger found
 */
export function extractDexterInstruction(commentBody: string): string | null {
  const match = commentBody.match(/@dexter\s+(.*)/i);
  return match ? match[1].trim() : null;
}

/**
 * GitHub webhook payload for issue_comment event on PRs
 */
export interface GitHubWebhookPayload {
  action: string;
  comment: {
    id: number;
    body: string;
    user: {
      login: string;
    };
  };
  issue: {
    number: number;
    pull_request?: {
      url: string;
    };
  };
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
  sender: {
    login: string;
  };
}

/**
 * Check if a GitHub webhook payload is a PR comment event
 */
export function isGitHubPRCommentEvent(payload: GitHubWebhookPayload): boolean {
  return (
    payload.action === "created" && payload.issue?.pull_request !== undefined
  );
}

/**
 * Extract JIRA issue key from PR branch name or title
 * Looks for patterns like DXTR-123, ABC-456, etc.
 */
export function extractIssueKeyFromBranch(branchName: string): string | null {
  const match = branchName.match(/([A-Z]+-\d+)/i);
  return match ? match[1].toUpperCase() : null;
}

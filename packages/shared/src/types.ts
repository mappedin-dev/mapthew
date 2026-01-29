import { getTriggerPattern } from "./config.js";

/**
 * Base job data common to all sources
 */
export interface BaseJob {
  instruction: string;
  triggeredBy: string;
}

/**
 * Job triggered from JIRA comment
 */
export interface JiraJob extends BaseJob {
  source: "jira";
  issueKey: string;
  projectKey: string;
}

/**
 * Job triggered from GitHub PR comment
 */
export interface GitHubJob extends BaseJob {
  source: "github";
  owner: string;
  repo: string;
  prNumber: number;
}

/**
 * Discriminated union of all job types
 */
export type Job = JiraJob | GitHubJob;

/**
 * Type guard for JiraJob
 */
export function isJiraJob(job: Job): job is JiraJob {
  return job.source === "jira";
}

/**
 * Type guard for GitHubJob
 */
export function isGitHubJob(job: Job): job is GitHubJob {
  return job.source === "github";
}

/**
 * JIRA API credentials for posting comments
 */
export interface JiraCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
}

/**
 * Result of posting a comment (JIRA or GitHub)
 */
export interface CommentResult {
  success: boolean;
  error?: string;
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
 * Extract bot instruction from comment body
 * Returns null if no trigger found (e.g., @mapthew or configured bot name)
 */
export function extractBotInstruction(commentBody: string): string | null {
  const match = commentBody.match(getTriggerPattern());
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

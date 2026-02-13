import type { JobJson, JobState, JobProgress } from "bullmq";
import { CLAUDE_MODELS } from "./constants.js";

// Re-export BullMQ types for convenience
export type { JobState, JobProgress };

/**
 * Available Claude model type
 */
export type ClaudeModel = (typeof CLAUDE_MODELS)[number];

/**
 * Application configuration stored in Redis
 */
export interface AppConfig {
  botName: string;
  claudeModel: ClaudeModel;
  /** Label that triggers a job when added to a JIRA issue */
  jiraLabelTrigger: string;
  /** Label to add to a JIRA issue after processing completes */
  jiraLabelAdd: string;
  /** Bot's JIRA account ID — used to recognize wiki markup mentions [~accountid:xxx] */
  jiraBotAccountId: string;
  /** Soft cap — oldest session evicted when exceeded */
  maxSessions: number;
  /** Sessions inactive longer than this (days) are pruned */
  pruneThresholdDays: number;
  /** How often the pruning job runs (days) */
  pruneIntervalDays: number;
  /** Max stdout/stderr buffer per CLI invocation in bytes (default: 10 MB) */
  maxOutputBufferBytes: number;
}

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
 * Job triggered from GitHub PR or issue comment
 */
export interface GitHubJob extends BaseJob {
  source: "github";
  owner: string;
  repo: string;
  prNumber?: number;
  issueNumber?: number;
  /** PR branch name (used to extract Jira issue key for session linking) */
  branchName?: string;
}

/**
 * Job triggered from admin dashboard
 */
export interface AdminJob extends BaseJob {
  source: "admin";
  // Optional JIRA context
  jiraBoardId?: string;
  jiraIssueKey?: string;
  // Optional GitHub context
  githubOwner?: string;
  githubRepo?: string;
  githubBranchId?: string;
  githubPrNumber?: number;
  githubIssueNumber?: number;
}

/**
 * Discriminated union of all job types
 */
export type Job = JiraJob | GitHubJob | AdminJob;

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
 * Atlassian Document Format (ADF) node types relevant to text extraction.
 * Jira sends ADF when rich mentions (autocomplete) are used in comments.
 */
export interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
}

/**
 * JIRA webhook payload for comment_created event
 * Minimal payload - MCP fetches full ticket details
 *
 * comment.body can be either:
 * - A plain text string (when user types without rich formatting)
 * - An ADF object (when user uses Jira's autocomplete for @mentions)
 */
export interface WebhookPayload {
  webhookEvent: string;
  comment: {
    body: string | AdfNode;
    author: {
      displayName: string;
    };
  };
  issue: {
    key: string;
  };
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
 * GitHub webhook payload for pull_request_review_comment event
 * Fired when a comment is made on a file diff in a PR review
 */
export interface GitHubReviewCommentPayload {
  action: string;
  comment: {
    id: number;
    body: string;
    path: string;
    user: {
      login: string;
    };
  };
  pull_request: {
    number: number;
    head: {
      ref: string;
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
 * JIRA webhook payload for jira:issue_updated event (label changes)
 * Used to detect when a trigger label is added to an issue
 */
export interface JiraIssueUpdatedPayload {
  webhookEvent: string;
  issue: {
    key: string;
    fields?: {
      summary?: string;
    };
  };
  changelog?: {
    items: Array<{
      field: string;
      fromString: string | null;
      toString: string | null;
    }>;
  };
  user?: {
    displayName: string;
  };
}

/**
 * GET /api/queue response
 */
export interface QueueStats {
  name: string;
  counts: Partial<Record<JobState, number>>;
}

/**
 * GET /api/queue/jobs response item
 * Derived from BullMQ's JobJson - adds status from getState()
 */
export type JobData = Pick<
  JobJson,
  | "id"
  | "name"
  | "data" // JSON string, client parses
  | "progress"
  | "attemptsMade"
  | "timestamp"
  | "processedOn"
  | "finishedOn"
  | "failedReason" // Empty string when no failure
  | "returnvalue" // JSON string, client parses
> & {
  status: JobState; // Added from job.getState()
};

/**
 * GET /api/secrets response
 */
export interface SecretsStatus {
  jira: {
    baseUrl: string;
    email: string;
    tokenMasked: string;
    webhookSecretMasked: string;
  };
  github: {
    tokenMasked: string;
    webhookSecretMasked: string;
  };
  figma: {
    apiKeyMasked: string;
  };
}

/**
 * Valid secret key identifiers for vault storage
 */
export type SecretKey =
  | "jiraBaseUrl"
  | "jiraEmail"
  | "jiraApiToken"
  | "jiraWebhookSecret"
  | "githubToken"
  | "githubWebhookSecret"
  | "figmaApiKey"
  | "anthropicApiKey";

/**
 * Payload for updating a single secret
 */
export interface SecretUpdate {
  key: SecretKey;
  value: string;
}

/**
 * Search result for Jira boards, issues, GitHub branches, PRs, issues
 */
export interface SearchResult {
  id: string;
  label: string;
}

/**
 * GitHub repository search result
 */
export interface GitHubRepoResult {
  owner: string;
  repo: string;
  label: string;
}

/**
 * Job context for creating admin jobs via POST /api/queue/jobs
 */
export interface AdminJobContext {
  jiraBoardId?: string;
  jiraIssueKey?: string;
  githubOwner?: string;
  githubRepo?: string;
  githubBranchId?: string;
  githubPrNumber?: number;
  githubIssueNumber?: number;
}

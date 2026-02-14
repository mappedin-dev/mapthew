import type {
  Job,
  JiraJob,
  GitHubJob,
  AdminJob,
  AdfNode,
  WebhookPayload,
  GitHubWebhookPayload,
  JiraIssueUpdatedPayload,
} from "./types.js";
import { extractInstructionFromAdf } from "./adf.js";

// Re-export ADF utilities so existing consumers of @mapthew/shared/utils still work
export { extractTextFromAdf } from "./adf.js";

// Internal state - can be updated at runtime
let botName: string | null = null;

// Valid bot name pattern: lowercase alphanumeric, dashes, underscores (safe for git branches and queue names)
const VALID_BOT_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

/**
 * Validate a bot name for use in branches and queue names
 * Must be lowercase alphanumeric with dashes/underscores, starting with alphanumeric
 */
export function isValidBotName(name: string): boolean {
  return VALID_BOT_NAME_PATTERN.test(name) && name.length <= 32;
}

/**
 * Validate a JIRA base URL
 * Must be a valid HTTPS URL
 */
export function isValidJiraUrl(url: string): boolean {
  if (!url) return true; // Empty is allowed (not configured)
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Get the bot name (used for triggers, branch prefixes, etc.)
 * Reads from: 1) runtime setter, 2) BOT_NAME env var, 3) default "mapthew"
 */
export function getBotName(): string {
  const name = botName ?? process.env.BOT_NAME ?? "mapthew";
  if (!isValidBotName(name)) {
    console.warn(
      `Invalid BOT_NAME "${name}" - must be lowercase alphanumeric with dashes/underscores (max 32 chars). Using "mapthew".`
    );
    return "mapthew";
  }
  return name;
}

/**
 * Get the bot name formatted for display (first letter capitalized)
 * e.g., "mapthew" -> "Mapthew", "code-bot" -> "Code-bot"
 */
export function getBotDisplayName(): string {
  const name = getBotName();
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Set the bot name at runtime (for future dashboard config)
 * @throws Error if the name is invalid
 */
export function setBotName(name: string): void {
  if (!isValidBotName(name)) {
    throw new Error(
      `Invalid bot name "${name}" - must be lowercase alphanumeric with dashes/underscores, starting with alphanumeric (max 32 chars)`
    );
  }
  botName = name;
}

/**
 * Get the regex pattern for detecting bot triggers in comments
 * e.g., /@mapthew\s+(.*)/i
 */
export function getTriggerPattern(): RegExp {
  return new RegExp(`@${getBotName()}\\s+(.*)`, "i");
}

/**
 * Get the BullMQ queue name
 */
export function getQueueName(): string {
  return `${getBotName()}-jobs`;
}

/**
 * Get the branch prefix for new branches
 */
export function getBranchPrefix(): string {
  return `${getBotName()}-bot`;
}

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
 * Type guard for AdminJob
 */
export function isAdminJob(job: Job): job is AdminJob {
  return job.source === "admin";
}

/**
 * Check if a webhook payload is a comment_created event
 */
export function isCommentCreatedEvent(payload: WebhookPayload): boolean {
  return payload.webhookEvent === "comment_created";
}

/**
 * Extract bot instruction from comment body.
 * Handles both plain text strings and ADF (Atlassian Document Format) objects.
 * Returns null if no trigger found (e.g., @mapthew or configured bot name).
 *
 * For ADF, uses two strategies:
 * 1. Find a rich mention node referencing the bot → extract following text
 * 2. Fall back to regex matching on the extracted plain text
 */
export function extractBotInstruction(commentBody: string | AdfNode): string | null {
  if (typeof commentBody === "string") {
    const match = commentBody.match(getTriggerPattern());
    return match ? match[1].trim() : null;
  }
  return extractInstructionFromAdf(commentBody);
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
 * Check if a GitHub webhook payload is an issue comment event
 */
export function isGitHubIssueCommentEvent(
  payload: GitHubWebhookPayload
): boolean {
  return (
    payload.action === "created" && payload.issue?.pull_request === undefined
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

/**
 * Check if a JIRA webhook payload is an issue_updated event
 */
export function isIssueUpdatedEvent(payload: JiraIssueUpdatedPayload): boolean {
  return payload.webhookEvent === "jira:issue_updated";
}

/**
 * Check if a specific label was added in a JIRA issue_updated event.
 * The changelog "Labels" field stores space-separated label lists.
 */
export function wasLabelAdded(
  payload: JiraIssueUpdatedPayload,
  label: string,
): boolean {
  if (!payload.changelog?.items) return false;

  return payload.changelog.items.some((item) => {
    if (item.field !== "labels") return false;

    const oldLabels = item.fromString
      ? item.fromString.split(/\s+/)
      : [];
    const newLabels = item.toString
      ? item.toString.split(/\s+/)
      : [];

    // Label was added if it's in the new set but not the old set
    return newLabels.includes(label) && !oldLabels.includes(label);
  });
}

/**
 * Get the configured JIRA label trigger from AppConfig.
 */
export function getLabelTrigger(config?: { jiraLabelTrigger?: string }): string {
  return config?.jiraLabelTrigger ?? "claude-ready";
}

/**
 * Get the configured JIRA label to add after processing from AppConfig.
 */
export function getLabelAdd(config?: { jiraLabelAdd?: string }): string {
  return config?.jiraLabelAdd ?? "claude-processed";
}

/**
 * Safely parse the JSON-stringified job.data field from the API.
 * Returns an empty object on invalid input.
 */
export function parseJobData(data: unknown): Record<string, unknown> {
  try {
    return typeof data === "string" ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

/**
 * Job data stored in the queue
 */
export interface Job {
  issueKey: string;
  instruction: string;
  triggeredBy: string;
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

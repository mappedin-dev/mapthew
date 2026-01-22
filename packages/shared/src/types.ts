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
 */
export interface WebhookPayload {
  webhookEvent: string;
  comment: {
    id: string;
    body: string;
    author: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
    };
    created: string;
  };
  issue: {
    id: string;
    key: string;
    fields: {
      summary: string;
      description?: string;
      project: {
        key: string;
        name: string;
      };
    };
  };
}

/**
 * Check if a webhook payload is a comment_created event
 */
export function isCommentCreatedEvent(payload: WebhookPayload): boolean {
  return payload.webhookEvent === 'comment_created';
}

/**
 * Extract @dexter instruction from comment body
 * Returns null if no @dexter trigger found
 */
export function extractDexterInstruction(commentBody: string): string | null {
  const match = commentBody.match(/@dexter\s+(.*)/i);
  return match ? match[1].trim() : null;
}

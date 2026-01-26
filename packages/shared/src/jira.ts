/**
 * JIRA API client utilities for polling and interacting with JIRA
 */

export interface JiraClientConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraComment {
  id: string;
  body: string;
  author: {
    displayName: string;
  };
  created: string;
  updated: string;
}

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    updated: string;
  };
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
}

export interface JiraCommentsResult {
  comments: JiraComment[];
  total: number;
}

/**
 * Create a JIRA API client with basic auth
 */
export function createJiraClient(config: JiraClientConfig) {
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString(
    "base64"
  );

  async function request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${config.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`JIRA API error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  return {
    /**
     * Search for issues using JQL (uses new /search/jql endpoint)
     */
    async searchIssues(jql: string, maxResults = 50): Promise<JiraSearchResult> {
      return request<JiraSearchResult>(`/rest/api/3/search/jql`, {
        method: "POST",
        body: JSON.stringify({
          jql,
          maxResults,
          fields: ["summary", "updated"],
        }),
      });
    },

    /**
     * Get comments for an issue
     */
    async getIssueComments(issueKey: string): Promise<JiraCommentsResult> {
      return request<JiraCommentsResult>(
        `/rest/api/3/issue/${issueKey}/comment`
      );
    },

    /**
     * Post a comment to an issue
     */
    async postComment(issueKey: string, comment: string): Promise<void> {
      await request(`/rest/api/3/issue/${issueKey}/comment`, {
        method: "POST",
        body: JSON.stringify({
          body: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: comment }],
              },
            ],
          },
        }),
      });
    },

    /**
     * Update labels for an issue (add and/or remove)
     */
    async updateLabels(
      issueKey: string,
      options: { add?: string[]; remove?: string[] }
    ): Promise<void> {
      const update: { labels: Array<{ add?: string; remove?: string }> } = {
        labels: [],
      };

      if (options.add) {
        for (const label of options.add) {
          update.labels.push({ add: label });
        }
      }

      if (options.remove) {
        for (const label of options.remove) {
          update.labels.push({ remove: label });
        }
      }

      if (update.labels.length === 0) return;

      await request(`/rest/api/3/issue/${issueKey}`, {
        method: "PUT",
        body: JSON.stringify({ update }),
      });
    },

    /**
     * Get available transitions for an issue
     */
    async getTransitions(
      issueKey: string
    ): Promise<Array<{ id: string; name: string }>> {
      const result = await request<{
        transitions: Array<{ id: string; name: string }>;
      }>(`/rest/api/3/issue/${issueKey}/transitions`);
      return result.transitions;
    },

    /**
     * Transition an issue to a new status
     * Returns true if successful, false if status not available
     */
    async transitionTo(issueKey: string, statusName: string): Promise<boolean> {
      const transitions = await this.getTransitions(issueKey);
      const transition = transitions.find(
        (t) => t.name.toLowerCase() === statusName.toLowerCase()
      );

      if (!transition) {
        console.warn(
          `Transition to "${statusName}" not available for ${issueKey}. Available: ${transitions.map((t) => t.name).join(", ")}`
        );
        return false;
      }

      await request(`/rest/api/3/issue/${issueKey}/transitions`, {
        method: "POST",
        body: JSON.stringify({ transition: { id: transition.id } }),
      });
      return true;
    },
  };
}

export type JiraClient = ReturnType<typeof createJiraClient>;

/**
 * Search for recently updated issues in a project
 */
export async function searchRecentlyUpdatedIssues(
  client: JiraClient,
  project: string,
  sinceMinutes: number
): Promise<JiraIssue[]> {
  const jql = `project = ${project} AND updated >= -${sinceMinutes}m ORDER BY updated DESC`;
  const result = await client.searchIssues(jql);
  return result.issues;
}

/**
 * Extract plain text from JIRA's Atlassian Document Format (ADF)
 * ADF is a nested JSON structure used by JIRA Cloud for rich text
 */
export function extractTextFromAdf(adf: unknown): string {
  if (!adf || typeof adf !== "object") {
    // Plain text fallback
    return typeof adf === "string" ? adf : "";
  }

  const doc = adf as { type?: string; content?: unknown[]; text?: string };

  if (doc.type === "text" && typeof doc.text === "string") {
    return doc.text;
  }

  if (Array.isArray(doc.content)) {
    return doc.content.map((node) => extractTextFromAdf(node)).join("");
  }

  return "";
}

/**
 * Get comment body as plain text, handling both string and ADF formats
 */
export function getCommentText(comment: JiraComment): string {
  const body = comment.body as unknown;
  if (typeof body === "string") {
    return body;
  }
  return extractTextFromAdf(body);
}

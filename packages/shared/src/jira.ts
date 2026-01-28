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
    "base64",
  );

  async function request<T>(
    endpoint: string,
    options: RequestInit = {},
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
    async searchIssues(
      jql: string,
      maxResults = 50,
    ): Promise<JiraSearchResult> {
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
        `/rest/api/3/issue/${issueKey}/comment`,
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
  };
}

export type JiraClient = ReturnType<typeof createJiraClient>;

/**
 * Search for recently updated issues in a project
 */
export async function searchRecentlyUpdatedIssues(
  client: JiraClient,
  project: string,
  sinceMinutes: number,
): Promise<JiraIssue[]> {
  const jql = `project = ${project} AND updated >= -${sinceMinutes}m ORDER BY updated DESC`;
  const result = await client.searchIssues(jql);
  return result.issues;
}

/**
 * Extract plain text from JIRA's Atlassian Document Format (ADF)
 * ADF is a nested JSON structure used by JIRA Cloud for rich text
 */
export function extractTextFromAdf(adf: unknown, debug = false): string {
  if (debug) {
    console.log("ADF structure:", JSON.stringify(adf, null, 2));
  }

  if (!adf || typeof adf !== "object") {
    // Plain text fallback
    return typeof adf === "string" ? adf : "";
  }

  const doc = adf as {
    type?: string;
    content?: unknown[];
    text?: string;
    attrs?: {
      url?: string;
      href?: string;
      data?: { url?: string };
    };
    marks?: Array<{ type: string; attrs?: { href?: string; url?: string } }>;
  };

  // Handle text nodes (may have link marks)
  if (doc.type === "text" && typeof doc.text === "string") {
    // Check if this text has a link mark
    const linkMark = doc.marks?.find((m) => m.type === "link");
    if (linkMark?.attrs?.href) {
      return linkMark.attrs.href;
    }
    return doc.text;
  }

  // Handle inlineCard nodes (JIRA's smart links for URLs, including GitHub)
  if (doc.type === "inlineCard") {
    const url = doc.attrs?.url || doc.attrs?.href || doc.attrs?.data?.url;
    if (url) return url;
  }

  // Handle blockCard nodes (larger smart link embeds)
  if (doc.type === "blockCard") {
    const url = doc.attrs?.url || doc.attrs?.href || doc.attrs?.data?.url;
    if (url) return url + "\n";
  }

  // Handle embedCard nodes (embedded content like GitHub PRs)
  if (doc.type === "embedCard") {
    const url = doc.attrs?.url || doc.attrs?.href || doc.attrs?.data?.url;
    if (url) return url + "\n";
  }

  // Handle hardBreak nodes
  if (doc.type === "hardBreak") {
    return "\n";
  }

  // Handle paragraph breaks
  if (doc.type === "paragraph") {
    const text = Array.isArray(doc.content)
      ? doc.content.map((node) => extractTextFromAdf(node, false)).join("")
      : "";
    return text + "\n";
  }

  // Recursively process content
  if (Array.isArray(doc.content)) {
    return doc.content.map((node) => extractTextFromAdf(node, false)).join("");
  }

  return "";
}

/**
 * Get comment body as plain text, handling both string and ADF formats
 */
export function getCommentText(comment: JiraComment, debug = false): string {
  const body = comment.body as unknown;
  if (typeof body === "string") {
    return body;
  }
  return extractTextFromAdf(body, debug);
}

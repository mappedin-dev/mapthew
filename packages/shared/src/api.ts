import { createHmac, timingSafeEqual } from "crypto";
import type { JiraCredentials, CommentResult } from "./types.js";

/**
 * Verify webhook signature using HMAC-SHA256
 * Works for both JIRA and GitHub webhooks
 */
export function verifyHmacSignature(
  secret: string,
  payload: string,
  signature: string,
): boolean {
  if (!signature) return false;

  // Handle both "sha256=xxx" format and raw signature
  const sig = signature.startsWith("sha256=") ? signature.slice(7) : signature;

  const expectedSignature = createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(sig, "hex"),
      Buffer.from(expectedSignature, "hex"),
    );
  } catch {
    return false;
  }
}

/**
 * Post a comment to a JIRA ticket
 */
export async function postJiraComment(
  credentials: JiraCredentials,
  issueKey: string,
  comment: string,
): Promise<CommentResult> {
  if (!credentials.baseUrl || !credentials.email || !credentials.apiToken) {
    console.warn("JIRA credentials not configured - skipping comment");
    return { success: false, error: "JIRA credentials not configured" };
  }

  const auth = Buffer.from(
    `${credentials.email}:${credentials.apiToken}`,
  ).toString("base64");

  try {
    const response = await fetch(
      `${credentials.baseUrl}/rest/api/3/issue/${issueKey}/comment`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
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
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to post JIRA comment:", errorText);
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to post JIRA comment:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Post a comment to a GitHub PR or issue
 */
export async function postGitHubComment(
  token: string,
  owner: string,
  repo: string,
  number: number,
  comment: string,
): Promise<CommentResult> {
  if (!token) {
    console.warn("GITHUB_TOKEN not configured - skipping comment");
    return { success: false, error: "GITHUB_TOKEN not configured" };
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${number}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ body: comment }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to post GitHub comment:", errorText);
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to post GitHub comment:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * GitHub PR details
 */
export interface GitHubPRDetails {
  number: number;
  title: string;
  branchName: string;
  baseBranch: string;
}

/**
 * Fetch PR details from GitHub API
 */
export async function fetchGitHubPRDetails(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<GitHubPRDetails | null> {
  if (!token) {
    console.warn("GITHUB_TOKEN not configured - cannot fetch PR details");
    return null;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch GitHub PR details:", errorText);
      return null;
    }

    const data = await response.json();
    return {
      number: data.number,
      title: data.title,
      branchName: data.head.ref,
      baseBranch: data.base.ref,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to fetch GitHub PR details:", errorMessage);
    return null;
  }
}

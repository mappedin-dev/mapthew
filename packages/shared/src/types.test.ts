import { describe, it, expect } from "vitest";
import {
  isJiraJob,
  isGitHubJob,
  isCommentCreatedEvent,
  extractDexterInstruction,
  isGitHubPRCommentEvent,
  extractIssueKeyFromBranch,
  type JiraJob,
  type GitHubJob,
  type WebhookPayload,
  type GitHubWebhookPayload,
} from "./types.js";

describe("isJiraJob", () => {
  it("returns true for JiraJob", () => {
    const job: JiraJob = {
      source: "jira",
      issueKey: "DXTR-123",
      projectKey: "DXTR",
      instruction: "implement this",
      triggeredBy: "user@example.com",
    };
    expect(isJiraJob(job)).toBe(true);
  });

  it("returns false for GitHubJob", () => {
    const job: GitHubJob = {
      source: "github",
      owner: "org",
      repo: "repo",
      prNumber: 42,
      instruction: "fix this",
      triggeredBy: "user",
    };
    expect(isJiraJob(job)).toBe(false);
  });
});

describe("isGitHubJob", () => {
  it("returns true for GitHubJob", () => {
    const job: GitHubJob = {
      source: "github",
      owner: "org",
      repo: "repo",
      prNumber: 42,
      instruction: "fix this",
      triggeredBy: "user",
    };
    expect(isGitHubJob(job)).toBe(true);
  });

  it("returns false for JiraJob", () => {
    const job: JiraJob = {
      source: "jira",
      issueKey: "DXTR-123",
      projectKey: "DXTR",
      instruction: "implement this",
      triggeredBy: "user@example.com",
    };
    expect(isGitHubJob(job)).toBe(false);
  });
});

describe("isCommentCreatedEvent", () => {
  it("returns true for comment_created event", () => {
    const payload: WebhookPayload = {
      webhookEvent: "comment_created",
      comment: {
        body: "@dexter do something",
        author: { displayName: "Test User" },
      },
      issue: { key: "DXTR-123" },
    };
    expect(isCommentCreatedEvent(payload)).toBe(true);
  });

  it("returns false for other events", () => {
    const payload: WebhookPayload = {
      webhookEvent: "comment_updated",
      comment: {
        body: "@dexter do something",
        author: { displayName: "Test User" },
      },
      issue: { key: "DXTR-123" },
    };
    expect(isCommentCreatedEvent(payload)).toBe(false);
  });
});

describe("extractDexterInstruction", () => {
  it("extracts instruction after @dexter", () => {
    expect(extractDexterInstruction("@dexter implement auth")).toBe(
      "implement auth",
    );
  });

  it("is case insensitive", () => {
    expect(extractDexterInstruction("@DEXTER implement auth")).toBe(
      "implement auth",
    );
    expect(extractDexterInstruction("@Dexter implement auth")).toBe(
      "implement auth",
    );
  });

  it("handles extra whitespace", () => {
    expect(extractDexterInstruction("@dexter   implement auth  ")).toBe(
      "implement auth",
    );
  });

  it("extracts from multiline comments", () => {
    const comment = `Hey team,

@dexter please add unit tests for this feature

Thanks!`;
    expect(extractDexterInstruction(comment)).toBe(
      "please add unit tests for this feature",
    );
  });

  it("returns null when no @dexter trigger", () => {
    expect(extractDexterInstruction("just a regular comment")).toBe(null);
  });

  it("returns null for empty string", () => {
    expect(extractDexterInstruction("")).toBe(null);
  });

  it("handles @dexter at end of line", () => {
    expect(extractDexterInstruction("@dexter")).toBe(null);
  });

  it("handles @dexter with only whitespace after", () => {
    expect(extractDexterInstruction("@dexter   ")).toBe("");
  });
});

describe("isGitHubPRCommentEvent", () => {
  it("returns true for PR comment created event", () => {
    const payload: GitHubWebhookPayload = {
      action: "created",
      comment: {
        id: 1,
        body: "@dexter fix this",
        user: { login: "testuser" },
      },
      issue: {
        number: 42,
        pull_request: { url: "https://api.github.com/repos/org/repo/pulls/42" },
      },
      repository: {
        name: "repo",
        owner: { login: "org" },
      },
      sender: { login: "testuser" },
    };
    expect(isGitHubPRCommentEvent(payload)).toBe(true);
  });

  it("returns false for issue comment (not PR)", () => {
    const payload: GitHubWebhookPayload = {
      action: "created",
      comment: {
        id: 1,
        body: "@dexter fix this",
        user: { login: "testuser" },
      },
      issue: {
        number: 42,
        // No pull_request field
      },
      repository: {
        name: "repo",
        owner: { login: "org" },
      },
      sender: { login: "testuser" },
    };
    expect(isGitHubPRCommentEvent(payload)).toBe(false);
  });

  it("returns false for edited comment", () => {
    const payload: GitHubWebhookPayload = {
      action: "edited",
      comment: {
        id: 1,
        body: "@dexter fix this",
        user: { login: "testuser" },
      },
      issue: {
        number: 42,
        pull_request: { url: "https://api.github.com/repos/org/repo/pulls/42" },
      },
      repository: {
        name: "repo",
        owner: { login: "org" },
      },
      sender: { login: "testuser" },
    };
    expect(isGitHubPRCommentEvent(payload)).toBe(false);
  });
});

describe("extractIssueKeyFromBranch", () => {
  it("extracts issue key from standard branch names", () => {
    expect(extractIssueKeyFromBranch("feature/DXTR-123-add-tests")).toBe(
      "DXTR-123",
    );
    expect(extractIssueKeyFromBranch("DXTR-456")).toBe("DXTR-456");
    expect(extractIssueKeyFromBranch("fix/ABC-789-bug-fix")).toBe("ABC-789");
  });

  it("handles lowercase issue keys", () => {
    expect(extractIssueKeyFromBranch("feature/dxtr-123-add-tests")).toBe(
      "DXTR-123",
    );
  });

  it("extracts first issue key when multiple present", () => {
    expect(extractIssueKeyFromBranch("DXTR-123-ABC-456")).toBe("DXTR-123");
  });

  it("returns null when no issue key present", () => {
    expect(extractIssueKeyFromBranch("feature/add-tests")).toBe(null);
    expect(extractIssueKeyFromBranch("main")).toBe(null);
    expect(extractIssueKeyFromBranch("")).toBe(null);
  });

  it("handles various project key formats", () => {
    expect(extractIssueKeyFromBranch("SDK-1")).toBe("SDK-1");
    expect(extractIssueKeyFromBranch("WEBAPP-12345")).toBe("WEBAPP-12345");
  });
});

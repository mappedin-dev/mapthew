import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isValidBotName,
  isValidJiraUrl,
  getBotName,
  setBotName,
  getBotDisplayName,
  getTriggerPattern,
  getQueueName,
  getBranchPrefix,
  isJiraJob,
  isGitHubJob,
  isAdminJob,
  isCommentCreatedEvent,
  extractBotInstruction,
  isGitHubPRCommentEvent,
  isGitHubIssueCommentEvent,
  extractIssueKeyFromBranch,
  parseJobData,
} from "./utils.js";
import type {
  JiraJob,
  GitHubJob,
  AdminJob,
  WebhookPayload,
  GitHubWebhookPayload,
} from "./types.js";

describe("isValidBotName", () => {
  it("accepts valid lowercase alphanumeric names", () => {
    expect(isValidBotName("mapthew")).toBe(true);
    expect(isValidBotName("bot123")).toBe(true);
    expect(isValidBotName("mybot")).toBe(true);
  });

  it("accepts names with dashes and underscores", () => {
    expect(isValidBotName("my-bot")).toBe(true);
    expect(isValidBotName("my_bot")).toBe(true);
    expect(isValidBotName("code-bot-123")).toBe(true);
  });

  it("rejects names starting with dash or underscore", () => {
    expect(isValidBotName("-bot")).toBe(false);
    expect(isValidBotName("_bot")).toBe(false);
  });

  it("rejects uppercase letters", () => {
    expect(isValidBotName("MyBot")).toBe(false);
    expect(isValidBotName("MAPTHEW")).toBe(false);
  });

  it("rejects special characters", () => {
    expect(isValidBotName("bot@name")).toBe(false);
    expect(isValidBotName("bot.name")).toBe(false);
    expect(isValidBotName("bot name")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidBotName("")).toBe(false);
  });

  it("rejects names longer than 32 characters", () => {
    expect(isValidBotName("a".repeat(32))).toBe(true);
    expect(isValidBotName("a".repeat(33))).toBe(false);
  });
});

describe("isValidJiraUrl", () => {
  it("accepts valid HTTPS URLs", () => {
    expect(isValidJiraUrl("https://company.atlassian.net")).toBe(true);
    expect(isValidJiraUrl("https://jira.example.com")).toBe(true);
  });

  it("accepts empty string (not configured)", () => {
    expect(isValidJiraUrl("")).toBe(true);
  });

  it("rejects HTTP URLs", () => {
    expect(isValidJiraUrl("http://company.atlassian.net")).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(isValidJiraUrl("not-a-url")).toBe(false);
    expect(isValidJiraUrl("company.atlassian.net")).toBe(false);
  });
});

describe("getBotName and setBotName", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    // Reset to known state
    setBotName("mapthew");
  });

  it("returns the name set by setBotName", () => {
    setBotName("testbot");
    expect(getBotName()).toBe("testbot");
  });

  it("throws error for invalid bot name", () => {
    expect(() => setBotName("Invalid-Name")).toThrow();
    expect(() => setBotName("")).toThrow();
    expect(() => setBotName("-invalid")).toThrow();
  });

  it("preserves valid name after failed setBotName attempt", () => {
    setBotName("validbot");
    expect(() => setBotName("Invalid-Name")).toThrow();
    // Should still have the previous valid name
    expect(getBotName()).toBe("validbot");
  });
});

describe("getBotDisplayName", () => {
  beforeEach(() => {
    setBotName("mapthew");
  });

  it("capitalizes first letter", () => {
    setBotName("mapthew");
    expect(getBotDisplayName()).toBe("Mapthew");
  });

  it("handles names with dashes", () => {
    setBotName("code-bot");
    expect(getBotDisplayName()).toBe("Code-bot");
  });

  it("handles single character name", () => {
    setBotName("a");
    expect(getBotDisplayName()).toBe("A");
  });
});

describe("getTriggerPattern", () => {
  beforeEach(() => {
    setBotName("mapthew");
  });

  it("creates regex for default bot name", () => {
    setBotName("mapthew");
    const pattern = getTriggerPattern();
    expect(pattern.test("@mapthew do something")).toBe(true);
    expect(pattern.test("@MAPTHEW do something")).toBe(true); // case insensitive
  });

  it("creates regex for custom bot name", () => {
    setBotName("testbot");
    const pattern = getTriggerPattern();
    expect(pattern.test("@testbot implement this")).toBe(true);
    expect(pattern.test("@mapthew implement this")).toBe(false);
  });

  it("captures instruction after trigger", () => {
    setBotName("mapthew");
    const pattern = getTriggerPattern();
    const match = "@mapthew implement auth".match(pattern);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("implement auth");
  });
});

describe("getQueueName", () => {
  it("returns queue name based on bot name", () => {
    setBotName("mapthew");
    expect(getQueueName()).toBe("mapthew-jobs");
  });

  it("updates when bot name changes", () => {
    setBotName("testbot");
    expect(getQueueName()).toBe("testbot-jobs");
  });
});

describe("getBranchPrefix", () => {
  it("returns branch prefix based on bot name", () => {
    setBotName("mapthew");
    expect(getBranchPrefix()).toBe("mapthew-bot");
  });

  it("updates when bot name changes", () => {
    setBotName("testbot");
    expect(getBranchPrefix()).toBe("testbot-bot");
  });
});

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

describe("isAdminJob", () => {
  it("returns true for AdminJob", () => {
    const job: AdminJob = {
      source: "admin",
      instruction: "run maintenance",
      triggeredBy: "admin",
    };
    expect(isAdminJob(job)).toBe(true);
  });

  it("returns true for AdminJob with optional context", () => {
    const job: AdminJob = {
      source: "admin",
      instruction: "fix bug",
      triggeredBy: "admin",
      jiraIssueKey: "PROJ-123",
      githubOwner: "org",
      githubRepo: "repo",
    };
    expect(isAdminJob(job)).toBe(true);
  });

  it("returns false for JiraJob", () => {
    const job: JiraJob = {
      source: "jira",
      issueKey: "DXTR-123",
      projectKey: "DXTR",
      instruction: "implement this",
      triggeredBy: "user@example.com",
    };
    expect(isAdminJob(job)).toBe(false);
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
    expect(isAdminJob(job)).toBe(false);
  });
});

describe("isCommentCreatedEvent", () => {
  it("returns true for comment_created event", () => {
    const payload: WebhookPayload = {
      webhookEvent: "comment_created",
      comment: {
        body: "@mapthew do something",
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
        body: "@mapthew do something",
        author: { displayName: "Test User" },
      },
      issue: { key: "DXTR-123" },
    };
    expect(isCommentCreatedEvent(payload)).toBe(false);
  });
});

describe("extractBotInstruction", () => {
  beforeEach(() => {
    setBotName("mapthew");
  });

  it("extracts instruction after @mapthew", () => {
    expect(extractBotInstruction("@mapthew implement auth")).toBe(
      "implement auth",
    );
  });

  it("is case insensitive", () => {
    expect(extractBotInstruction("@MAPTHEW implement auth")).toBe(
      "implement auth",
    );
    expect(extractBotInstruction("@Mapthew implement auth")).toBe(
      "implement auth",
    );
  });

  it("handles extra whitespace", () => {
    expect(extractBotInstruction("@mapthew   implement auth  ")).toBe(
      "implement auth",
    );
  });

  it("extracts from multiline comments", () => {
    const comment = `Hey team,

@mapthew please add unit tests for this feature

Thanks!`;
    expect(extractBotInstruction(comment)).toBe(
      "please add unit tests for this feature",
    );
  });

  it("returns null when no @mapthew trigger", () => {
    expect(extractBotInstruction("just a regular comment")).toBe(null);
  });

  it("returns null for empty string", () => {
    expect(extractBotInstruction("")).toBe(null);
  });

  it("handles @mapthew at end of line", () => {
    expect(extractBotInstruction("@mapthew")).toBe(null);
  });

  it("handles @mapthew with only whitespace after", () => {
    expect(extractBotInstruction("@mapthew   ")).toBe("");
  });
});

describe("isGitHubPRCommentEvent", () => {
  it("returns true for PR comment created event", () => {
    const payload: GitHubWebhookPayload = {
      action: "created",
      comment: {
        id: 1,
        body: "@mapthew fix this",
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
        body: "@mapthew fix this",
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
        body: "@mapthew fix this",
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

describe("isGitHubIssueCommentEvent", () => {
  it("returns true for issue comment created event", () => {
    const payload: GitHubWebhookPayload = {
      action: "created",
      comment: {
        id: 1,
        body: "@mapthew fix this",
        user: { login: "testuser" },
      },
      issue: {
        number: 100,
        // No pull_request field - this is an issue
      },
      repository: {
        name: "repo",
        owner: { login: "org" },
      },
      sender: { login: "testuser" },
    };
    expect(isGitHubIssueCommentEvent(payload)).toBe(true);
  });

  it("returns false for PR comment (has pull_request)", () => {
    const payload: GitHubWebhookPayload = {
      action: "created",
      comment: {
        id: 1,
        body: "@mapthew fix this",
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
    expect(isGitHubIssueCommentEvent(payload)).toBe(false);
  });

  it("returns false for edited issue comment", () => {
    const payload: GitHubWebhookPayload = {
      action: "edited",
      comment: {
        id: 1,
        body: "@mapthew fix this",
        user: { login: "testuser" },
      },
      issue: {
        number: 100,
        // No pull_request field
      },
      repository: {
        name: "repo",
        owner: { login: "org" },
      },
      sender: { login: "testuser" },
    };
    expect(isGitHubIssueCommentEvent(payload)).toBe(false);
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

describe("parseJobData", () => {
  it("parses a valid JSON string", () => {
    const data = JSON.stringify({ source: "github", owner: "org", repo: "repo" });
    expect(parseJobData(data)).toEqual({ source: "github", owner: "org", repo: "repo" });
  });

  it("returns empty object for invalid JSON string", () => {
    expect(parseJobData("not valid json")).toEqual({});
  });

  it("returns empty object for non-string input", () => {
    expect(parseJobData(null)).toEqual({});
    expect(parseJobData(undefined)).toEqual({});
    expect(parseJobData(123)).toEqual({});
    expect(parseJobData({})).toEqual({});
  });

  it("returns empty object for empty string", () => {
    expect(parseJobData("")).toEqual({});
  });
});

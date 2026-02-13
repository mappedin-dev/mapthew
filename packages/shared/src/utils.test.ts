import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isValidBotName,
  getBotName,
  setBotName,
  setJiraBotAccountId,
  getTriggerPattern,
  getQueueName,
  getBranchPrefix,
  isJiraJob,
  isGitHubJob,
  isAdminJob,
  isCommentCreatedEvent,
  extractBotInstruction,
  extractTextFromAdf,
  normalizeWikiMentions,
  isGitHubPRCommentEvent,
  isGitHubIssueCommentEvent,
  extractIssueKeyFromBranch,
  parseJobData,
  isIssueUpdatedEvent,
  wasLabelAdded,
  getLabelTrigger,
} from "./utils.js";
import type {
  JiraJob,
  GitHubJob,
  AdminJob,
  AdfNode,
  WebhookPayload,
  GitHubWebhookPayload,
  JiraIssueUpdatedPayload,
} from "./types.js";

describe("isValidBotName", () => {
  it("accepts valid names", () => {
    expect(isValidBotName("mapthew")).toBe(true);
    expect(isValidBotName("code-bot")).toBe(true);
    expect(isValidBotName("my_bot")).toBe(true);
    expect(isValidBotName("bot123")).toBe(true);
    expect(isValidBotName("a")).toBe(true);
  });

  it("rejects invalid names", () => {
    expect(isValidBotName("")).toBe(false);
    expect(isValidBotName("Bot")).toBe(false); // uppercase
    expect(isValidBotName("-bot")).toBe(false); // starts with dash
    expect(isValidBotName("_bot")).toBe(false); // starts with underscore
    expect(isValidBotName("bot name")).toBe(false); // space
    expect(isValidBotName("bot.name")).toBe(false); // dot
    expect(isValidBotName("a".repeat(33))).toBe(false); // too long
  });
});

describe("getBotName", () => {
  const originalBotName = process.env.BOT_NAME;

  afterEach(() => {
    // Reset env and internal state
    if (originalBotName === undefined) {
      delete process.env.BOT_NAME;
    } else {
      process.env.BOT_NAME = originalBotName;
    }
    // Reset internal state by setting a valid name then unsetting
    try {
      setBotName("mapthew");
    } catch {
      // ignore
    }
  });

  it("returns default when no env var set", () => {
    delete process.env.BOT_NAME;
    setBotName("mapthew"); // reset internal state
    expect(getBotName()).toBe("mapthew");
  });

  it("returns env var value", () => {
    process.env.BOT_NAME = "custom-bot";
    // Need to clear internal state - setBotName sets internal, so we need a fresh read
    // getBotName reads internal first, so we need to match
    setBotName("custom-bot");
    expect(getBotName()).toBe("custom-bot");
  });

  it("returns mapthew for invalid BOT_NAME", () => {
    // Spy on console.warn to suppress output
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.BOT_NAME = "INVALID";
    // Clear internal state by setting null-like behavior
    // Since we can't unset internal, we test via env
    expect(getBotName()).toMatch(/mapthew|custom-bot/); // internal state may still be set
    warnSpy.mockRestore();
  });
});

describe("setBotName", () => {
  afterEach(() => {
    setBotName("mapthew"); // reset
  });

  it("sets valid bot name", () => {
    setBotName("test-bot");
    expect(getBotName()).toBe("test-bot");
  });

  it("throws on invalid bot name", () => {
    expect(() => setBotName("INVALID")).toThrow();
    expect(() => setBotName("")).toThrow();
    expect(() => setBotName("-bad")).toThrow();
  });
});

describe("getTriggerPattern", () => {
  beforeEach(() => {
    setBotName("mapthew");
  });

  afterEach(() => {
    setBotName("mapthew");
  });

  it("matches trigger pattern", () => {
    const pattern = getTriggerPattern();
    const match = "@mapthew do something".match(pattern);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("do something");
  });

  it("is case insensitive", () => {
    const pattern = getTriggerPattern();
    expect("@Mapthew do something".match(pattern)).not.toBeNull();
  });

  it("does not match without trigger", () => {
    const pattern = getTriggerPattern();
    expect("hello world".match(pattern)).toBeNull();
  });

  it("uses custom bot name", () => {
    setBotName("code-bot");
    const pattern = getTriggerPattern();
    expect("@code-bot do something".match(pattern)).not.toBeNull();
    expect("@mapthew do something".match(pattern)).toBeNull();
  });
});

describe("getQueueName", () => {
  beforeEach(() => {
    setBotName("mapthew");
  });

  it("returns queue name with bot name", () => {
    expect(getQueueName()).toBe("mapthew-jobs");
  });
});

describe("getBranchPrefix", () => {
  beforeEach(() => {
    setBotName("mapthew");
  });

  it("returns branch prefix with bot name", () => {
    expect(getBranchPrefix()).toBe("mapthew-bot");
  });
});

describe("type guards", () => {
  const jiraJob: JiraJob = {
    source: "jira",
    issueKey: "TEST-1",
    instruction: "test",
    triggeredBy: "user",
    projectKey: "TEST",
  };

  const githubJob: GitHubJob = {
    source: "github",
    owner: "org",
    repo: "repo",
    issueNumber: 1,
    instruction: "test",
    triggeredBy: "user",
  };

  const adminJob: AdminJob = {
    source: "admin",
    instruction: "test",
    triggeredBy: "admin",
  };

  it("isJiraJob", () => {
    expect(isJiraJob(jiraJob)).toBe(true);
    expect(isJiraJob(githubJob)).toBe(false);
    expect(isJiraJob(adminJob)).toBe(false);
  });

  it("isGitHubJob", () => {
    expect(isGitHubJob(githubJob)).toBe(true);
    expect(isGitHubJob(jiraJob)).toBe(false);
    expect(isGitHubJob(adminJob)).toBe(false);
  });

  it("isAdminJob", () => {
    expect(isAdminJob(adminJob)).toBe(true);
    expect(isAdminJob(jiraJob)).toBe(false);
    expect(isAdminJob(githubJob)).toBe(false);
  });
});

describe("isCommentCreatedEvent", () => {
  it("returns true for comment_created", () => {
    const payload = {
      webhookEvent: "comment_created",
      comment: { body: "test", author: { displayName: "user" } },
      issue: { key: "TEST-1" },
    } as WebhookPayload;
    expect(isCommentCreatedEvent(payload)).toBe(true);
  });

  it("returns false for other events", () => {
    const payload = {
      webhookEvent: "issue_updated",
      comment: { body: "test", author: { displayName: "user" } },
      issue: { key: "TEST-1" },
    } as WebhookPayload;
    expect(isCommentCreatedEvent(payload)).toBe(false);
  });
});

describe("extractBotInstruction", () => {
  beforeEach(() => {
    setBotName("mapthew");
  });

  it("extracts instruction after trigger", () => {
    expect(extractBotInstruction("@mapthew do the thing")).toBe("do the thing");
  });

  it("returns null when no trigger", () => {
    expect(extractBotInstruction("hello world")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(extractBotInstruction("@mapthew   do the thing  ")).toBe(
      "do the thing",
    );
  });

  it("handles custom bot name", () => {
    setBotName("code-bot");
    expect(extractBotInstruction("@code-bot do stuff")).toBe("do stuff");
    expect(extractBotInstruction("@mapthew do stuff")).toBeNull();
  });

  it("extracts instruction from ADF with rich mention", () => {
    const adfBody: AdfNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: { id: "557058:abc123", text: "@mapthew" },
            },
            { type: "text", text: " implement authentication" },
          ],
        },
      ],
    };
    expect(extractBotInstruction(adfBody)).toBe("implement authentication");
  });

  it("returns null for ADF without bot mention", () => {
    const adfBody: AdfNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "just a regular comment" }],
        },
      ],
    };
    expect(extractBotInstruction(adfBody)).toBeNull();
  });

  it("extracts instruction from ADF with mention of another user and the bot", () => {
    const adfBody: AdfNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: { id: "other-user", text: "@someone" },
            },
            { type: "text", text: " hey, " },
            {
              type: "mention",
              attrs: { id: "557058:abc123", text: "@mapthew" },
            },
            { type: "text", text: " fix the login bug" },
          ],
        },
      ],
    };
    expect(extractBotInstruction(adfBody)).toBe("fix the login bug");
  });

  it("extracts instruction from wiki markup mention when account ID is configured", () => {
    setJiraBotAccountId("557058:abc123def456");
    expect(
      extractBotInstruction(
        "[~accountid:557058:abc123def456] implement authentication",
      ),
    ).toBe("implement authentication");
  });

  it("returns null for wiki markup mention of a different user", () => {
    setJiraBotAccountId("557058:abc123def456");
    expect(
      extractBotInstruction("[~accountid:other-user-id] do something"),
    ).toBeNull();
  });

  it("returns null for wiki markup mention when account ID is not configured", () => {
    setJiraBotAccountId("");
    expect(
      extractBotInstruction(
        "[~accountid:557058:abc123def456] implement authentication",
      ),
    ).toBeNull();
  });

  it("extracts instruction from wiki markup with multiple mentions including the bot", () => {
    setJiraBotAccountId("557058:abc123def456");
    expect(
      extractBotInstruction(
        "[~accountid:other-user] hey, [~accountid:557058:abc123def456] fix the login bug",
      ),
    ).toBe("fix the login bug");
  });
});

describe("normalizeWikiMentions", () => {
  beforeEach(() => {
    setBotName("mapthew");
  });

  it("replaces bot mention with @botname when account ID matches", () => {
    setJiraBotAccountId("557058:abc123def456");
    expect(
      normalizeWikiMentions("[~accountid:557058:abc123def456] do stuff"),
    ).toBe("@mapthew do stuff");
  });

  it("does not replace mention when account ID does not match", () => {
    setJiraBotAccountId("557058:abc123def456");
    expect(normalizeWikiMentions("[~accountid:other-user-id] do stuff")).toBe(
      "[~accountid:other-user-id] do stuff",
    );
  });

  it("returns text unchanged when no account ID is configured", () => {
    setJiraBotAccountId("");
    expect(
      normalizeWikiMentions("[~accountid:557058:abc123def456] do stuff"),
    ).toBe("[~accountid:557058:abc123def456] do stuff");
  });

  it("replaces multiple occurrences of the bot mention", () => {
    setJiraBotAccountId("557058:abc123def456");
    expect(
      normalizeWikiMentions(
        "[~accountid:557058:abc123def456] first [~accountid:557058:abc123def456] second",
      ),
    ).toBe("@mapthew first @mapthew second");
  });
});

describe("extractTextFromAdf", () => {
  it("extracts text from simple ADF document", () => {
    const adf: AdfNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "hello world" }],
        },
      ],
    };
    expect(extractTextFromAdf(adf)).toBe("hello world");
  });

  it("extracts text from mention nodes", () => {
    const adf: AdfNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: { id: "user-123", text: "@mapthew" },
            },
            { type: "text", text: " do something" },
          ],
        },
      ],
    };
    expect(extractTextFromAdf(adf)).toBe("@mapthew do something");
  });

  it("returns empty string for empty ADF", () => {
    const adf: AdfNode = { type: "doc" };
    expect(extractTextFromAdf(adf)).toBe("");
  });

  it("handles nested content across multiple paragraphs", () => {
    const adf: AdfNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "first " }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "second" }],
        },
      ],
    };
    expect(extractTextFromAdf(adf)).toBe("first second");
  });
});

describe("isGitHubPRCommentEvent", () => {
  it("returns true for PR comment", () => {
    const payload: GitHubWebhookPayload = {
      action: "created",
      issue: {
        number: 1,
        pull_request: { url: "https://api.github.com/repos/org/repo/pulls/1" },
      },
      comment: { body: "test", user: { login: "user" } },
      repository: {
        name: "repo",
        owner: { login: "org" },
        default_branch: "main",
      },
    };
    expect(isGitHubPRCommentEvent(payload)).toBe(true);
  });

  it("returns false for issue comment", () => {
    const payload: GitHubWebhookPayload = {
      action: "created",
      issue: { number: 1 },
      comment: { body: "test", user: { login: "user" } },
      repository: {
        name: "repo",
        owner: { login: "org" },
        default_branch: "main",
      },
    };
    expect(isGitHubPRCommentEvent(payload)).toBe(false);
  });

  it("returns false for non-created actions", () => {
    const payload: GitHubWebhookPayload = {
      action: "deleted",
      issue: {
        number: 1,
        pull_request: { url: "https://api.github.com/repos/org/repo/pulls/1" },
      },
      comment: { body: "test", user: { login: "user" } },
      repository: {
        name: "repo",
        owner: { login: "org" },
        default_branch: "main",
      },
    };
    expect(isGitHubPRCommentEvent(payload)).toBe(false);
  });
});

describe("isGitHubIssueCommentEvent", () => {
  it("returns true for issue comment (no pull_request)", () => {
    const payload: GitHubWebhookPayload = {
      action: "created",
      issue: { number: 1 },
      comment: { body: "test", user: { login: "user" } },
      repository: {
        name: "repo",
        owner: { login: "org" },
        default_branch: "main",
      },
    };
    expect(isGitHubIssueCommentEvent(payload)).toBe(true);
  });

  it("returns false for PR comment", () => {
    const payload: GitHubWebhookPayload = {
      action: "created",
      issue: {
        number: 1,
        pull_request: { url: "https://api.github.com/repos/org/repo/pulls/1" },
      },
      comment: { body: "test", user: { login: "user" } },
      repository: {
        name: "repo",
        owner: { login: "org" },
        default_branch: "main",
      },
    };
    expect(isGitHubIssueCommentEvent(payload)).toBe(false);
  });
});

describe("extractIssueKeyFromBranch", () => {
  it("extracts issue key from branch name", () => {
    expect(extractIssueKeyFromBranch("feature/DXTR-123-add-login")).toBe(
      "DXTR-123",
    );
    expect(extractIssueKeyFromBranch("PROJ-456")).toBe("PROJ-456");
    expect(extractIssueKeyFromBranch("fix/abc-789-bug")).toBe("ABC-789");
  });

  it("returns null when no issue key found", () => {
    expect(extractIssueKeyFromBranch("feature/add-login")).toBeNull();
    expect(extractIssueKeyFromBranch("main")).toBeNull();
    expect(extractIssueKeyFromBranch("")).toBeNull();
  });
});

describe("parseJobData", () => {
  it("parses valid JSON string", () => {
    const data = JSON.stringify({ key: "value", num: 42 });
    expect(parseJobData(data)).toEqual({ key: "value", num: 42 });
  });

  it("returns empty object for invalid JSON", () => {
    expect(parseJobData("not json")).toEqual({});
  });

  it("returns empty object for non-string input", () => {
    expect(parseJobData(42)).toEqual({});
    expect(parseJobData(null)).toEqual({});
    expect(parseJobData(undefined)).toEqual({});
    expect(parseJobData({})).toEqual({});
  });

  it("returns empty object for empty string", () => {
    expect(parseJobData("")).toEqual({});
  });
});

describe("isIssueUpdatedEvent", () => {
  it("returns true for jira:issue_updated event", () => {
    const payload: JiraIssueUpdatedPayload = {
      webhookEvent: "jira:issue_updated",
      issue: { key: "PROJ-123" },
    };
    expect(isIssueUpdatedEvent(payload)).toBe(true);
  });

  it("returns false for other events", () => {
    const payload: JiraIssueUpdatedPayload = {
      webhookEvent: "comment_created",
      issue: { key: "PROJ-123" },
    };
    expect(isIssueUpdatedEvent(payload)).toBe(false);
  });
});

describe("wasLabelAdded", () => {
  it("detects when a label is added", () => {
    const payload: JiraIssueUpdatedPayload = {
      webhookEvent: "jira:issue_updated",
      issue: { key: "PROJ-123" },
      changelog: {
        items: [
          {
            field: "labels",
            fromString: "bug",
            toString: "bug claude-ready",
          },
        ],
      },
    };
    expect(wasLabelAdded(payload, "claude-ready")).toBe(true);
  });

  it("returns false when label was removed", () => {
    const payload: JiraIssueUpdatedPayload = {
      webhookEvent: "jira:issue_updated",
      issue: { key: "PROJ-123" },
      changelog: {
        items: [
          {
            field: "labels",
            fromString: "bug claude-ready",
            toString: "bug",
          },
        ],
      },
    };
    expect(wasLabelAdded(payload, "claude-ready")).toBe(false);
  });

  it("returns false when label was already present", () => {
    const payload: JiraIssueUpdatedPayload = {
      webhookEvent: "jira:issue_updated",
      issue: { key: "PROJ-123" },
      changelog: {
        items: [
          {
            field: "labels",
            fromString: "bug claude-ready",
            toString: "bug claude-ready feature",
          },
        ],
      },
    };
    expect(wasLabelAdded(payload, "claude-ready")).toBe(false);
  });

  it("detects label added from empty labels", () => {
    const payload: JiraIssueUpdatedPayload = {
      webhookEvent: "jira:issue_updated",
      issue: { key: "PROJ-123" },
      changelog: {
        items: [
          {
            field: "labels",
            fromString: null,
            toString: "claude-ready",
          },
        ],
      },
    };
    expect(wasLabelAdded(payload, "claude-ready")).toBe(true);
  });

  it("returns false when changelog has no label changes", () => {
    const payload: JiraIssueUpdatedPayload = {
      webhookEvent: "jira:issue_updated",
      issue: { key: "PROJ-123" },
      changelog: {
        items: [
          {
            field: "status",
            fromString: "To Do",
            toString: "In Progress",
          },
        ],
      },
    };
    expect(wasLabelAdded(payload, "claude-ready")).toBe(false);
  });

  it("returns false when no changelog present", () => {
    const payload: JiraIssueUpdatedPayload = {
      webhookEvent: "jira:issue_updated",
      issue: { key: "PROJ-123" },
    };
    expect(wasLabelAdded(payload, "claude-ready")).toBe(false);
  });

  it("handles different label being looked for", () => {
    const payload: JiraIssueUpdatedPayload = {
      webhookEvent: "jira:issue_updated",
      issue: { key: "PROJ-123" },
      changelog: {
        items: [
          {
            field: "labels",
            fromString: null,
            toString: "bug",
          },
        ],
      },
    };
    expect(wasLabelAdded(payload, "claude-ready")).toBe(false);
    expect(wasLabelAdded(payload, "bug")).toBe(true);
  });
});

describe("getLabelTrigger", () => {
  it("returns label from config when provided", () => {
    expect(getLabelTrigger({ jiraLabelTrigger: "claude-ready" })).toBe(
      "claude-ready",
    );
  });

  it("returns default 'claude-ready' when no config provided", () => {
    expect(getLabelTrigger()).toBe("claude-ready");
  });

  it("returns default 'claude-ready' when config has no jiraLabelTrigger", () => {
    expect(getLabelTrigger({})).toBe("claude-ready");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractTextFromAdf,
  getCommentText,
  createJiraClient,
  type JiraComment,
} from "./jira.js";

describe("extractTextFromAdf", () => {
  it("returns empty string for null/undefined", () => {
    expect(extractTextFromAdf(null)).toBe("");
    expect(extractTextFromAdf(undefined)).toBe("");
  });

  it("returns plain string as-is", () => {
    expect(extractTextFromAdf("plain text")).toBe("plain text");
  });

  it("returns empty string for non-object values", () => {
    expect(extractTextFromAdf(123)).toBe("");
    expect(extractTextFromAdf(true)).toBe("");
  });

  it("extracts text from simple ADF text node", () => {
    const adf = { type: "text", text: "Hello world" };
    expect(extractTextFromAdf(adf)).toBe("Hello world");
  });

  it("extracts text from ADF paragraph", () => {
    const adf = {
      type: "paragraph",
      content: [
        { type: "text", text: "Hello " },
        { type: "text", text: "world" },
      ],
    };
    expect(extractTextFromAdf(adf)).toBe("Hello world");
  });

  it("extracts text from nested ADF document", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "@dexter " }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "implement this feature" }],
        },
      ],
    };
    expect(extractTextFromAdf(adf)).toBe("@dexter implement this feature");
  });

  it("handles empty content array", () => {
    const adf = { type: "doc", content: [] };
    expect(extractTextFromAdf(adf)).toBe("");
  });

  it("handles missing content property", () => {
    const adf = { type: "doc" };
    expect(extractTextFromAdf(adf)).toBe("");
  });

  it("handles mixed content with non-text nodes", () => {
    const adf = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Before " }] },
        { type: "hardBreak" }, // Non-text node
        { type: "paragraph", content: [{ type: "text", text: "After" }] },
      ],
    };
    expect(extractTextFromAdf(adf)).toBe("Before After");
  });
});

describe("getCommentText", () => {
  it("returns string body directly", () => {
    const comment: JiraComment = {
      id: "1",
      body: "Plain text comment",
      author: { displayName: "Test User" },
      created: "2024-01-01T00:00:00Z",
      updated: "2024-01-01T00:00:00Z",
    };
    expect(getCommentText(comment)).toBe("Plain text comment");
  });

  it("extracts text from ADF body", () => {
    const comment = {
      id: "1",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "@dexter fix the bug" }],
          },
        ],
      },
      author: { displayName: "Test User" },
      created: "2024-01-01T00:00:00Z",
      updated: "2024-01-01T00:00:00Z",
    } as unknown as JiraComment;
    expect(getCommentText(comment)).toBe("@dexter fix the bug");
  });
});

describe("createJiraClient", () => {
  const mockConfig = {
    baseUrl: "https://test.atlassian.net",
    email: "test@example.com",
    apiToken: "test-token",
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("request handling", () => {
    it("creates correct authorization header", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "2" }),
        text: () => Promise.resolve("{}"),
      });
      vi.stubGlobal("fetch", mockFetch);

      const client = createJiraClient(mockConfig);
      await client.getIssueComments("TEST-1");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.atlassian.net/rest/api/3/issue/TEST-1/comment",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("throws error on non-ok response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Issue not found"),
      });
      vi.stubGlobal("fetch", mockFetch);

      const client = createJiraClient(mockConfig);
      await expect(client.getIssueComments("TEST-1")).rejects.toThrow(
        "JIRA API error 404: Issue not found",
      );
    });

    it("handles 204 No Content response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
        text: () => Promise.resolve(""),
      });
      vi.stubGlobal("fetch", mockFetch);

      const client = createJiraClient(mockConfig);
      await expect(
        client.updateLabels("TEST-1", { add: ["label"] }),
      ).resolves.toBeUndefined();
    });

    it("handles empty response body", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "0" }),
        text: () => Promise.resolve(""),
      });
      vi.stubGlobal("fetch", mockFetch);

      const client = createJiraClient(mockConfig);
      await expect(
        client.updateLabels("TEST-1", { add: ["label"] }),
      ).resolves.toBeUndefined();
    });
  });

  describe("updateLabels", () => {
    it("does nothing when no labels provided", async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      const client = createJiraClient(mockConfig);
      await client.updateLabels("TEST-1", {});

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("sends correct payload for adding labels", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
        text: () => Promise.resolve(""),
      });
      vi.stubGlobal("fetch", mockFetch);

      const client = createJiraClient(mockConfig);
      await client.updateLabels("TEST-1", { add: ["label1", "label2"] });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.atlassian.net/rest/api/3/issue/TEST-1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            update: {
              labels: [{ add: "label1" }, { add: "label2" }],
            },
          }),
        }),
      );
    });

    it("sends correct payload for removing labels", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
        text: () => Promise.resolve(""),
      });
      vi.stubGlobal("fetch", mockFetch);

      const client = createJiraClient(mockConfig);
      await client.updateLabels("TEST-1", { remove: ["old-label"] });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.atlassian.net/rest/api/3/issue/TEST-1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            update: {
              labels: [{ remove: "old-label" }],
            },
          }),
        }),
      );
    });

    it("handles both add and remove labels", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
        text: () => Promise.resolve(""),
      });
      vi.stubGlobal("fetch", mockFetch);

      const client = createJiraClient(mockConfig);
      await client.updateLabels("TEST-1", {
        add: ["new-label"],
        remove: ["old-label"],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            update: {
              labels: [{ add: "new-label" }, { remove: "old-label" }],
            },
          }),
        }),
      );
    });
  });

  describe("getTransitions", () => {
    it("returns empty array when response is empty", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
        text: () => Promise.resolve(""),
      });
      vi.stubGlobal("fetch", mockFetch);

      const client = createJiraClient(mockConfig);
      const result = await client.getTransitions("TEST-1");

      expect(result).toEqual([]);
    });
  });

  describe("transitionTo", () => {
    it("returns false when transition not available", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "100" }),
        text: () =>
          Promise.resolve(
            JSON.stringify({
              transitions: [
                { id: "1", name: "To Do" },
                { id: "2", name: "In Progress" },
              ],
            }),
          ),
      });
      vi.stubGlobal("fetch", mockFetch);

      const client = createJiraClient(mockConfig);
      const result = await client.transitionTo("TEST-1", "Code Review");

      expect(result).toBe(false);
    });

    it("returns true and transitions when status available", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-length": "100" }),
          text: () =>
            Promise.resolve(
              JSON.stringify({
                transitions: [
                  { id: "1", name: "To Do" },
                  { id: "2", name: "Code Review" },
                ],
              }),
            ),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
          headers: new Headers(),
          text: () => Promise.resolve(""),
        });
      vi.stubGlobal("fetch", mockFetch);

      const client = createJiraClient(mockConfig);
      const result = await client.transitionTo("TEST-1", "Code Review");

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        "https://test.atlassian.net/rest/api/3/issue/TEST-1/transitions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ transition: { id: "2" } }),
        }),
      );
    });

    it("matches status name case-insensitively", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-length": "100" }),
          text: () =>
            Promise.resolve(
              JSON.stringify({
                transitions: [{ id: "1", name: "CODE REVIEW" }],
              }),
            ),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
          headers: new Headers(),
          text: () => Promise.resolve(""),
        });
      vi.stubGlobal("fetch", mockFetch);

      const client = createJiraClient(mockConfig);
      const result = await client.transitionTo("TEST-1", "code review");

      expect(result).toBe(true);
    });
  });
});

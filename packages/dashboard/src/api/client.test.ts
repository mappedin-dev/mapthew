import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, setTokenGetter } from "./client";

describe("API client", () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("token handling", () => {
    it("throws when token getter throws an error", async () => {
      // Set a token getter that simulates an auth failure
      setTokenGetter(async () => {
        throw new Error("Authentication failed - unable to get token");
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await expect(api.getConfig()).rejects.toThrow("Authentication failed");
    });

    it("includes authorization header with token", async () => {
      setTokenGetter(async () => "test-token-123");

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ name: "test" }),
      });

      await api.getQueueStats();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/queue",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token-123",
            "Content-Type": "application/json",
          }),
        })
      );
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      setTokenGetter(async () => "valid-token");
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(api.getJob("nonexistent")).rejects.toThrow(
        "API error: 404 Not Found"
      );
    });

    it("throws on 500 server error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(api.getConfig()).rejects.toThrow(
        "API error: 500 Internal Server Error"
      );
    });
  });

  describe("URL building", () => {
    beforeEach(() => {
      setTokenGetter(async () => "valid-token");
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });

    it("builds correct URL for getJobs with status filter", async () => {
      await api.getJobs("failed");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/queue\/jobs\?.*status=failed/),
        expect.any(Object)
      );
    });

    it("builds correct URL for getJobs with limit", async () => {
      await api.getJobs(undefined, 25);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/queue\/jobs\?.*limit=25/),
        expect.any(Object)
      );
    });

    it("encodes search query parameters", async () => {
      await api.searchJiraBoards("test query with spaces");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/search/jira/boards?q=test%20query%20with%20spaces",
        expect.any(Object)
      );
    });

    it("encodes special characters in search queries", async () => {
      await api.searchGitHubRepos("org/repo#123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("org%2Frepo%23123"),
        expect.any(Object)
      );
    });

    it("builds correct URL for GitHub branches search", async () => {
      await api.searchGitHubBranches("myorg", "myrepo", "feature");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/search/github/branches?owner=myorg&repo=myrepo&q=feature",
        expect.any(Object)
      );
    });
  });

  describe("request methods", () => {
    beforeEach(() => {
      setTokenGetter(async () => "valid-token");
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    it("uses POST for retryJob", async () => {
      await api.retryJob("123");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/queue/jobs/123/retry",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("uses DELETE for removeJob", async () => {
      await api.removeJob("456");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/queue/jobs/456",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("uses PUT for updateConfig", async () => {
      await api.updateConfig({ botName: "newbot" });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/config",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ botName: "newbot" }),
        })
      );
    });

    it("sends instruction in createJob body", async () => {
      await api.createJob("Test instruction", { jiraIssueKey: "TEST-1" });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/queue/jobs",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            instruction: "Test instruction",
            jiraIssueKey: "TEST-1",
          }),
        })
      );
    });
  });

  describe("search endpoints", () => {
    beforeEach(() => {
      setTokenGetter(async () => "valid-token");
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });

    it("searches JIRA issues with board filter", async () => {
      await api.searchJiraIssues("test query", "board-123");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/search/jira/issues?q=test%20query&board=board-123",
        expect.any(Object)
      );
    });

    it("searches GitHub pulls", async () => {
      await api.searchGitHubPulls("owner", "repo", "feature");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/search/github/pulls?owner=owner&repo=repo&q=feature",
        expect.any(Object)
      );
    });

    it("searches GitHub issues", async () => {
      await api.searchGitHubIssues("owner", "repo", "bug");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/search/github/issues?owner=owner&repo=repo&q=bug",
        expect.any(Object)
      );
    });
  });

  describe("secrets endpoint", () => {
    beforeEach(() => {
      setTokenGetter(async () => "valid-token");
    });

    it("fetches secrets status", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jira: { email: "test@example.com", tokenMasked: "****" },
            github: { tokenMasked: "****" },
          }),
      });

      const result = await api.getSecrets();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/secrets",
        expect.any(Object)
      );
      expect(result.jira.email).toBe("test@example.com");
    });
  });

  describe("network errors", () => {
    beforeEach(() => {
      setTokenGetter(async () => "valid-token");
    });

    it("throws on network failure", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(api.getConfig()).rejects.toThrow("Network error");
    });

    it("throws on fetch abort", async () => {
      mockFetch.mockRejectedValue(new DOMException("Aborted", "AbortError"));

      await expect(api.getQueueStats()).rejects.toThrow("Aborted");
    });
  });
});

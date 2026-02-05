import { describe, it, expect } from "vitest";
import { getReadableId } from "./utils.js";
import type { JiraJob, GitHubJob, AdminJob } from "@mapthew/shared/types";

describe("getReadableId", () => {
  describe("JiraJob", () => {
    it("returns issue key for JiraJob", () => {
      const job: JiraJob = {
        source: "jira",
        issueKey: "DXTR-123",
        projectKey: "DXTR",
        instruction: "implement this",
        triggeredBy: "user@example.com",
      };
      expect(getReadableId(job)).toBe("DXTR-123");
    });
  });

  describe("GitHubJob", () => {
    it("returns repo#prNumber for PR job", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "org",
        repo: "myrepo",
        prNumber: 42,
        instruction: "fix this",
        triggeredBy: "user",
      };
      expect(getReadableId(job)).toBe("myrepo#42");
    });

    it("returns repo#issueNumber for issue job", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "org",
        repo: "myrepo",
        issueNumber: 15,
        instruction: "fix this",
        triggeredBy: "user",
      };
      expect(getReadableId(job)).toBe("myrepo#15");
    });

    it("returns just repo when no number", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "org",
        repo: "myrepo",
        instruction: "do something",
        triggeredBy: "user",
      };
      expect(getReadableId(job)).toBe("myrepo");
    });

    it("prefers prNumber over issueNumber", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "org",
        repo: "myrepo",
        prNumber: 10,
        issueNumber: 20,
        instruction: "fix this",
        triggeredBy: "user",
      };
      expect(getReadableId(job)).toBe("myrepo#10");
    });
  });

  describe("AdminJob", () => {
    it("returns 'admin' for AdminJob", () => {
      const job: AdminJob = {
        source: "admin",
        instruction: "do something",
        triggeredBy: "admin",
      };
      expect(getReadableId(job)).toBe("admin");
    });

    it("returns 'admin' even with optional context", () => {
      const job: AdminJob = {
        source: "admin",
        instruction: "do something",
        triggeredBy: "admin",
        jiraIssueKey: "ABC-123",
        githubOwner: "org",
        githubRepo: "repo",
      };
      expect(getReadableId(job)).toBe("admin");
    });
  });
});

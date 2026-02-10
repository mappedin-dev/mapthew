import { describe, it, expect } from "vitest";
import { buildPrompt, buildJiraPostProcessing } from "./prompt.js";
import type { JiraJob, GitHubJob, AdminJob } from "@mapthew/shared/types";

describe("buildPrompt", () => {
  describe("JiraJob", () => {
    it("builds prompt with JIRA context", () => {
      const job: JiraJob = {
        source: "jira",
        issueKey: "DXTR-123",
        projectKey: "DXTR",
        instruction: "implement authentication",
        triggeredBy: "john@example.com",
      };

      const prompt = buildPrompt(job);

      // Verify instruction is included
      expect(prompt).toContain("implement authentication");

      // Verify JIRA context is injected
      expect(prompt).toContain("DXTR-123");

      // Verify triggeredBy is included
      expect(prompt).toContain("john@example.com");
    });

    it("sets GitHub context to unknown for JIRA jobs", () => {
      const job: JiraJob = {
        source: "jira",
        issueKey: "ABC-456",
        projectKey: "ABC",
        instruction: "do something",
        triggeredBy: "user@example.com",
      };

      const prompt = buildPrompt(job);

      // GitHub fields should be "unknown" for JIRA jobs since no GitHub context provided
      expect(prompt).toContain("ABC-456"); // JIRA context should be present
      // Verify the prompt doesn't contain actual GitHub values (only "unknown" placeholders)
      expect(prompt).not.toMatch(/github\.owner:\s*(?!unknown)[a-zA-Z]/);
    });
  });

  describe("GitHubJob", () => {
    it("builds prompt with GitHub PR context", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "myorg",
        repo: "myrepo",
        prNumber: 42,
        instruction: "add unit tests",
        triggeredBy: "developer",
      };

      const prompt = buildPrompt(job);

      // Verify instruction is included
      expect(prompt).toContain("add unit tests");

      // Verify GitHub context is injected
      expect(prompt).toContain("myorg");
      expect(prompt).toContain("myrepo");

      // PR number should be in the prompt
      expect(prompt).toContain("42");
    });

    it("builds prompt with GitHub issue context", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "org",
        repo: "repo",
        issueNumber: 100,
        instruction: "implement feature",
        triggeredBy: "user",
      };

      const prompt = buildPrompt(job);

      expect(prompt).toContain("implement feature");
      expect(prompt).toContain("org");
      expect(prompt).toContain("repo");
    });

    it("includes PR number when provided", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "org",
        repo: "repo",
        prNumber: 5,
        instruction: "update code",
        triggeredBy: "dev",
      };

      const prompt = buildPrompt(job);
      expect(prompt).toContain("5");
    });
  });

  describe("AdminJob", () => {
    it("builds prompt with minimal admin context", () => {
      const job: AdminJob = {
        source: "admin",
        instruction: "run maintenance task",
        triggeredBy: "admin",
      };

      const prompt = buildPrompt(job);

      expect(prompt).toContain("run maintenance task");
      expect(prompt).toContain("admin");
    });

    it("builds prompt with full admin context", () => {
      const job: AdminJob = {
        source: "admin",
        instruction: "complex task",
        triggeredBy: "admin",
        jiraIssueKey: "PROJ-999",
        jiraBoardId: "board-123",
        githubOwner: "company",
        githubRepo: "codebase",
        githubPrNumber: 50,
      };

      const prompt = buildPrompt(job);

      expect(prompt).toContain("complex task");
      expect(prompt).toContain("PROJ-999");
      expect(prompt).toContain("company");
      expect(prompt).toContain("codebase");
      expect(prompt).toContain("50");
    });
  });

  describe("JIRA post-processing", () => {
    it("includes transition instruction for JIRA jobs by default", () => {
      const job: JiraJob = {
        source: "jira",
        issueKey: "POST-1",
        projectKey: "POST",
        instruction: "do work",
        triggeredBy: "user",
      };

      const prompt = buildPrompt(job);

      // Default (no env vars): should always include the transition step
      expect(prompt).toContain("Transition to an appropriate status");
    });

    it("does not include post-processing for GitHub jobs", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "org",
        repo: "repo",
        prNumber: 1,
        instruction: "do work",
        triggeredBy: "user",
      };

      const prompt = buildPrompt(job);

      // GitHub jobs should not have JIRA post-processing
      expect(prompt).not.toContain("Transition to an appropriate status");
    });
  });

  describe("buildJiraPostProcessing", () => {
    it("returns only transition step when no labels configured", () => {
      const result = buildJiraPostProcessing("", "");
      expect(result).toBe(
        '- Transition to an appropriate status (e.g., "Code Review", "In Review", "Ready for Review") based on available transitions'
      );
      expect(result).not.toContain("Add label");
      expect(result).not.toContain("Remove label");
    });

    it("includes add label step when JIRA_LABEL_ADD is set", () => {
      const result = buildJiraPostProcessing("claude-processed", "");
      expect(result).toContain('- Add label: "claude-processed"');
      expect(result).not.toContain("Remove label");
      expect(result).toContain("Transition to an appropriate status");
    });

    it("includes remove label step when JIRA_LABEL_TRIGGER is set", () => {
      const result = buildJiraPostProcessing("", "claude-ready");
      expect(result).toContain('- Remove label: "claude-ready" (if present)');
      expect(result).not.toContain("Add label");
      expect(result).toContain("Transition to an appropriate status");
    });

    it("includes both label steps when both are set", () => {
      const result = buildJiraPostProcessing("claude-processed", "claude-ready");
      expect(result).toContain('- Add label: "claude-processed"');
      expect(result).toContain('- Remove label: "claude-ready" (if present)');
      expect(result).toContain("Transition to an appropriate status");
    });

    it("always includes transition step regardless of labels", () => {
      const noLabels = buildJiraPostProcessing("", "");
      const addOnly = buildJiraPostProcessing("done", "");
      const removeOnly = buildJiraPostProcessing("", "ready");
      const both = buildJiraPostProcessing("done", "ready");

      for (const result of [noLabels, addOnly, removeOnly, both]) {
        expect(result).toContain("Transition to an appropriate status");
      }
    });
  });

  describe("GitHub branchId", () => {
    it("includes branchName in prompt for GitHub jobs", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "org",
        repo: "repo",
        prNumber: 1,
        branchName: "feature/my-branch",
        instruction: "fix bug",
        triggeredBy: "dev",
      };

      const prompt = buildPrompt(job);
      expect(prompt).toContain("feature/my-branch");
    });

    it("includes branchId in prompt for admin jobs", () => {
      const job: AdminJob = {
        source: "admin",
        instruction: "do work",
        triggeredBy: "admin",
        githubOwner: "org",
        githubRepo: "repo",
        githubBranchId: "fix/admin-branch",
      };

      const prompt = buildPrompt(job);
      expect(prompt).toContain("fix/admin-branch");
    });
  });

  describe("prompt structure", () => {
    it("returns non-empty prompt with substantial content", () => {
      const job: JiraJob = {
        source: "jira",
        issueKey: "X-1",
        projectKey: "X",
        instruction: "test instruction",
        triggeredBy: "user",
      };

      const prompt = buildPrompt(job);
      expect(prompt.length).toBeGreaterThan(100); // Should have substantial content from instruction files
      expect(prompt).toContain("test instruction"); // Instruction must be included
    });

    it("concatenates multiple instruction files with separator", () => {
      const job: JiraJob = {
        source: "jira",
        issueKey: "Y-1",
        projectKey: "Y",
        instruction: "unique-test-string",
        triggeredBy: "user",
      };

      const prompt = buildPrompt(job);
      // Instruction files are joined with "---" separator
      // This indicates multiple templates were loaded and combined
      const separatorCount = (prompt.match(/---/g) || []).length;
      expect(separatorCount).toBeGreaterThanOrEqual(1);
    });

    it("replaces template variables with job context", () => {
      const job: JiraJob = {
        source: "jira",
        issueKey: "PROJ-999",
        projectKey: "PROJ",
        instruction: "implement feature",
        triggeredBy: "developer@test.com",
      };

      const prompt = buildPrompt(job);
      // Variables should be replaced, not left as placeholders
      expect(prompt).not.toContain("{{instruction}}");
      expect(prompt).not.toContain("{{triggeredBy}}");
      // Actual values should be present
      expect(prompt).toContain("implement feature");
      expect(prompt).toContain("developer@test.com");
    });
  });
});

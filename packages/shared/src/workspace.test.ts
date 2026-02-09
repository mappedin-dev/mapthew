import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import {
  getOrCreateWorkspace,
  hasExistingSession,
  workspaceExists,
  cleanupWorkspace,
  getSessionCount,
  canCreateSession,
  listSessions,
  getOldestSession,
  getWorkspacesDir,
  getMaxSessions,
  getClaudeSessionDir,
} from "./workspace.js";

// Use a unique test directory for each test run
let testWorkspacesDir: string;
let testHomeDir: string;
let originalWorkspacesDir: string | undefined;
let originalMaxSessions: string | undefined;
let originalHome: string | undefined;

describe("workspace", () => {
  beforeEach(async () => {
    // Save original env values
    originalWorkspacesDir = process.env.WORKSPACES_DIR;
    originalMaxSessions = process.env.MAX_SESSIONS;
    originalHome = process.env.HOME;

    // Create unique test directories
    const testId = `dexter-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testWorkspacesDir = path.join(os.tmpdir(), testId);
    testHomeDir = path.join(os.tmpdir(), `${testId}-home`);
    await fs.mkdir(testWorkspacesDir, { recursive: true });
    await fs.mkdir(path.join(testHomeDir, ".claude", "projects"), {
      recursive: true,
    });

    // Set environment variables directly
    process.env.WORKSPACES_DIR = testWorkspacesDir;
    process.env.MAX_SESSIONS = "3";
    process.env.HOME = testHomeDir;
  });

  afterEach(async () => {
    // Clean up test directories
    try {
      await fs.rm(testWorkspacesDir, { recursive: true, force: true });
      await fs.rm(testHomeDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Restore original env values
    if (originalWorkspacesDir !== undefined) {
      process.env.WORKSPACES_DIR = originalWorkspacesDir;
    } else {
      delete process.env.WORKSPACES_DIR;
    }
    if (originalMaxSessions !== undefined) {
      process.env.MAX_SESSIONS = originalMaxSessions;
    } else {
      delete process.env.MAX_SESSIONS;
    }
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
  });

  describe("getWorkspacesDir", () => {
    it("returns the configured workspaces directory", () => {
      expect(getWorkspacesDir()).toBe(testWorkspacesDir);
    });
  });

  describe("getMaxSessions", () => {
    it("returns the configured max sessions", () => {
      expect(getMaxSessions()).toBe(3);
    });
  });

  describe("getOrCreateWorkspace", () => {
    it("creates directory if not exists", async () => {
      const issueKey = "DXTR-123";
      const workDir = await getOrCreateWorkspace(issueKey);

      expect(workDir).toBe(path.join(testWorkspacesDir, issueKey));

      const stat = await fs.stat(workDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it("returns existing directory if exists", async () => {
      const issueKey = "DXTR-456";
      const expectedPath = path.join(testWorkspacesDir, issueKey);

      // Create the directory first
      await fs.mkdir(expectedPath, { recursive: true });
      await fs.writeFile(path.join(expectedPath, "test.txt"), "existing");

      const workDir = await getOrCreateWorkspace(issueKey);

      expect(workDir).toBe(expectedPath);

      // Verify the existing file is still there
      const content = await fs.readFile(path.join(workDir, "test.txt"), "utf-8");
      expect(content).toBe("existing");
    });

    it("updates the last-used marker file", async () => {
      const issueKey = "DXTR-789";
      const workDir = await getOrCreateWorkspace(issueKey);

      const markerPath = path.join(workDir, ".dexter-last-used");
      const content = await fs.readFile(markerPath, "utf-8");
      const timestamp = new Date(content.trim());

      // Should be recent (within last minute)
      expect(Date.now() - timestamp.getTime()).toBeLessThan(60000);
    });
  });

  /**
   * Helper: create a Claude session directory for a workspace.
   * Mirrors getClaudeSessionDir logic (uses ~/.claude/projects/{encoded-path}).
   */
  async function createClaudeSession(workDir: string): Promise<string> {
    const sessionDir = getClaudeSessionDir(workDir);
    await fs.mkdir(sessionDir, { recursive: true });
    return sessionDir;
  }

  describe("hasExistingSession", () => {
    // Helper to get the Claude session path for a workspace
    function getClaudeSessionPath(workDir: string): string {
      const encoded = workDir.replace(/\//g, "-");
      return path.join(testHomeDir, ".claude", "projects", encoded);
    }

    it("returns false when Claude session directory does not exist", async () => {
      const workDir = path.join(testWorkspacesDir, "no-session");
      await fs.mkdir(workDir, { recursive: true });

      expect(await hasExistingSession(workDir)).toBe(false);
    });

    it("returns true when Claude session directory exists", async () => {
      const workDir = path.join(testWorkspacesDir, "has-session");
      await fs.mkdir(workDir, { recursive: true });
      // Create Claude session in ~/.claude/projects/{encoded-path}
      await fs.mkdir(getClaudeSessionPath(workDir), { recursive: true });

      expect(await hasExistingSession(workDir)).toBe(true);
    });

    it("returns false when session path is a file not a directory", async () => {
      const workDir = path.join(testWorkspacesDir, "claude-file");
      await fs.mkdir(workDir, { recursive: true });
      // Create parent directories but make the session path a file
      const sessionPath = getClaudeSessionPath(workDir);
      await fs.mkdir(path.dirname(sessionPath), { recursive: true });
      await fs.writeFile(sessionPath, "not a directory");

      expect(await hasExistingSession(workDir)).toBe(false);
    });
  });

  describe("workspaceExists", () => {
    it("returns false when workspace does not exist", async () => {
      expect(await workspaceExists("NONEXISTENT-123")).toBe(false);
    });

    it("returns true when workspace exists", async () => {
      const issueKey = "EXISTS-123";
      await fs.mkdir(path.join(testWorkspacesDir, issueKey), { recursive: true });

      expect(await workspaceExists(issueKey)).toBe(true);
    });
  });

  describe("cleanupWorkspace", () => {
    it("removes the workspace directory", async () => {
      const issueKey = "CLEANUP-123";
      const workDir = path.join(testWorkspacesDir, issueKey);
      await fs.mkdir(workDir, { recursive: true });
      await fs.writeFile(path.join(workDir, "test.txt"), "test");

      await cleanupWorkspace(issueKey);

      await expect(fs.stat(workDir)).rejects.toThrow();
    });

    it("removes the Claude session directory", async () => {
      const issueKey = "CLEANUP-456";
      const workDir = path.join(testWorkspacesDir, issueKey);
      await fs.mkdir(workDir, { recursive: true });
      const sessionDir = await createClaudeSession(workDir);

      await cleanupWorkspace(issueKey);

      await expect(fs.stat(sessionDir)).rejects.toThrow();
    });

    it("does not throw when workspace does not exist", async () => {
      await expect(cleanupWorkspace("NONEXISTENT-999")).resolves.not.toThrow();
    });
  });

  describe("getSessionCount", () => {
    it("returns 0 when no workspaces exist", async () => {
      expect(await getSessionCount()).toBe(0);
    });

    it("returns 0 when workspaces exist but have no Claude sessions", async () => {
      await fs.mkdir(path.join(testWorkspacesDir, "WS-1"), { recursive: true });
      await fs.mkdir(path.join(testWorkspacesDir, "WS-2"), { recursive: true });

      expect(await getSessionCount()).toBe(0);
    });

    it("counts only workspaces with Claude session directories", async () => {
      // Create 3 workspaces, 2 with Claude sessions in ~/.claude/projects/
      const ws1 = path.join(testWorkspacesDir, "WS-1");
      const ws2 = path.join(testWorkspacesDir, "WS-2");
      const ws3 = path.join(testWorkspacesDir, "WS-3");

      await fs.mkdir(ws1, { recursive: true });
      await fs.mkdir(ws2, { recursive: true });
      await fs.mkdir(ws3, { recursive: true });

      await createClaudeSession(ws1);
      // ws2 has no session
      await createClaudeSession(ws3);

      expect(await getSessionCount()).toBe(2);
    });
  });

  describe("canCreateSession", () => {
    it("returns true when under the limit", async () => {
      // MAX_SESSIONS is 3, no sessions exist
      expect(await canCreateSession()).toBe(true);
    });

    it("returns false when at the limit", async () => {
      // Create 3 workspaces with Claude sessions (at limit)
      const ws1 = path.join(testWorkspacesDir, "WS-1");
      const ws2 = path.join(testWorkspacesDir, "WS-2");
      const ws3 = path.join(testWorkspacesDir, "WS-3");

      await fs.mkdir(ws1, { recursive: true });
      await fs.mkdir(ws2, { recursive: true });
      await fs.mkdir(ws3, { recursive: true });

      await createClaudeSession(ws1);
      await createClaudeSession(ws2);
      await createClaudeSession(ws3);

      expect(await canCreateSession()).toBe(false);
    });

    it("returns true when sessions exist but under limit", async () => {
      // Create 2 workspaces with Claude sessions (under limit of 3)
      const ws1 = path.join(testWorkspacesDir, "WS-1");
      const ws2 = path.join(testWorkspacesDir, "WS-2");

      await fs.mkdir(ws1, { recursive: true });
      await fs.mkdir(ws2, { recursive: true });

      await createClaudeSession(ws1);
      await createClaudeSession(ws2);

      expect(await canCreateSession()).toBe(true);
    });
  });

  describe("listSessions", () => {
    it("returns empty array when no workspaces exist", async () => {
      const sessions = await listSessions();
      expect(sessions).toEqual([]);
    });

    it("returns session info for all workspaces", async () => {
      // Create workspaces
      const ws1 = path.join(testWorkspacesDir, "DXTR-1");
      const ws2 = path.join(testWorkspacesDir, "DXTR-2");

      await fs.mkdir(ws1, { recursive: true });
      await fs.mkdir(ws2, { recursive: true });

      // ws1 has a Claude session, ws2 does not
      await createClaudeSession(ws1);

      // Write marker files
      await fs.writeFile(
        path.join(ws1, ".dexter-last-used"),
        new Date("2024-01-01").toISOString(),
      );
      await fs.writeFile(
        path.join(ws2, ".dexter-last-used"),
        new Date("2024-01-02").toISOString(),
      );

      const sessions = await listSessions();

      expect(sessions).toHaveLength(2);

      // Should be sorted by last used (most recent first)
      expect(sessions[0].issueKey).toBe("DXTR-2");
      expect(sessions[0].hasSession).toBe(false);

      expect(sessions[1].issueKey).toBe("DXTR-1");
      expect(sessions[1].hasSession).toBe(true);
    });

    it("includes size information for sessions", async () => {
      const ws = path.join(testWorkspacesDir, "DXTR-SIZE");
      await fs.mkdir(ws, { recursive: true });

      // Create Claude session and add a file to it
      const sessionDir = await createClaudeSession(ws);
      await fs.writeFile(path.join(sessionDir, "session.jsonl"), "x".repeat(1000));

      const sessions = await listSessions();

      expect(sessions[0].sizeBytes).toBeGreaterThanOrEqual(1000);
    });
  });

  describe("getOldestSession", () => {
    it("returns null when no active sessions exist", async () => {
      // Create workspace without session
      await fs.mkdir(path.join(testWorkspacesDir, "NO-SESSION"), {
        recursive: true,
      });

      expect(await getOldestSession()).toBeNull();
    });

    it("returns the least recently used session", async () => {
      // Create workspaces with Claude sessions and different timestamps
      const ws1 = path.join(testWorkspacesDir, "OLD-1");
      const ws2 = path.join(testWorkspacesDir, "NEW-1");

      await fs.mkdir(ws1, { recursive: true });
      await fs.mkdir(ws2, { recursive: true });

      await createClaudeSession(ws1);
      await createClaudeSession(ws2);

      // Set timestamps
      await fs.writeFile(
        path.join(ws1, ".dexter-last-used"),
        new Date("2024-01-01").toISOString(),
      );
      await fs.writeFile(
        path.join(ws2, ".dexter-last-used"),
        new Date("2024-06-01").toISOString(),
      );

      const oldest = await getOldestSession();

      expect(oldest).not.toBeNull();
      expect(oldest!.issueKey).toBe("OLD-1");
    });
  });
});

import fs from "fs/promises";
import path from "path";
import { getBotName } from "./utils.js";
import { getConfig } from "./config.js";

/**
 * Validate an issue key to prevent path traversal.
 * Accepts Jira keys (PROJ-123), GitHub keys (gh-owner-repo-42),
 * and admin keys (admin-1234567890).
 */
const ISSUE_KEY_PATTERN = /^[A-Za-z0-9][\w.-]*$/;

export function validateIssueKey(issueKey: string): void {
  if (!issueKey || !ISSUE_KEY_PATTERN.test(issueKey)) {
    throw new Error(`Invalid issue key format: ${issueKey}`);
  }
}

/**
 * Session information for monitoring
 */
export interface SessionInfo {
  issueKey: string;
  workspacePath: string;
  createdAt: Date;
  lastUsed: Date;
  hasSession: boolean;
  sizeBytes: number;
}

/**
 * Get the workspaces directory path.
 * Cached after first call — the env var is not expected to change at runtime.
 */
let _workspacesDir: string | null = null;
export function getWorkspacesDir(): string {
  if (_workspacesDir === null) {
    _workspacesDir = process.env.WORKSPACES_DIR || `/tmp/${getBotName()}-workspaces`;
  }
  return _workspacesDir;
}

/** @internal Reset cached workspaces dir (for testing only) */
export function _resetWorkspacesDirCache(): void {
  _workspacesDir = null;
}

/**
 * Get the max sessions limit (soft cap).
 * Reads from Redis config, falling back to env var / default.
 */
export async function getMaxSessions(): Promise<number> {
  const config = await getConfig();
  return config.maxSessions;
}

/**
 * Get or create a persistent workspace for an issue
 */
export async function getOrCreateWorkspace(issueKey: string): Promise<string> {
  validateIssueKey(issueKey);
  const workspacesDir = getWorkspacesDir();
  const workDir = path.join(workspacesDir, issueKey);
  await fs.mkdir(workDir, { recursive: true });

  // Update last used time by touching a marker file
  const markerPath = path.join(workDir, ".dexter-last-used");
  await fs.writeFile(markerPath, new Date().toISOString());

  return workDir;
}

/**
 * Get the Claude home directory path
 * Claude Code CLI stores sessions in ~/.claude/projects/
 *
 * Supports CLAUDE_CONFIG_DIR env var to override the default path.
 * This is needed when the claude-sessions volume is mounted at a
 * different path (e.g. on the webhook container for read-only access).
 */
function getClaudeHomeDir(): string {
  if (process.env.CLAUDE_CONFIG_DIR) {
    return process.env.CLAUDE_CONFIG_DIR;
  }
  const home = process.env.HOME || "/home/worker";
  return path.join(home, ".claude");
}

/**
 * Encode a workspace path to Claude's project directory name format
 * Claude replaces / with - in the path
 */
function encodeWorkspacePath(workDir: string): string {
  return workDir.replace(/\//g, "-");
}

/**
 * Get the Claude session directory path for a given workspace.
 * Claude Code CLI stores sessions in ~/.claude/projects/{encoded-path}
 */
export function getClaudeSessionDir(workDir: string): string {
  const claudeProjectsDir = path.join(getClaudeHomeDir(), "projects");
  const encodedPath = encodeWorkspacePath(workDir);
  return path.join(claudeProjectsDir, encodedPath);
}

/**
 * Check if a workspace has an existing Claude session
 * Claude Code CLI stores sessions in ~/.claude/projects/{encoded-path}
 */
export async function hasExistingSession(workDir: string): Promise<boolean> {
  const sessionDir = getClaudeSessionDir(workDir);

  try {
    const stat = await fs.stat(sessionDir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a workspace exists for an issue key
 */
export async function workspaceExists(issueKey: string): Promise<boolean> {
  validateIssueKey(issueKey);
  const workspacesDir = getWorkspacesDir();
  const workDir = path.join(workspacesDir, issueKey);
  try {
    const stat = await fs.stat(workDir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Clean up a workspace by issue key.
 * Removes both the workspace directory and the Claude session data.
 */
export async function cleanupWorkspace(issueKey: string): Promise<void> {
  validateIssueKey(issueKey);
  const workspacesDir = getWorkspacesDir();
  const workDir = path.join(workspacesDir, issueKey);

  // Remove the Claude session data from ~/.claude/projects/
  const sessionDir = getClaudeSessionDir(workDir);
  try {
    await fs.rm(sessionDir, { recursive: true, force: true });
  } catch (error) {
    console.warn(
      `[Session] Failed to cleanup Claude session for ${issueKey}:`,
      error,
    );
  }

  // Remove the workspace directory
  try {
    await fs.rm(workDir, { recursive: true, force: true });
    console.log(`[Session] Cleaned up workspace for ${issueKey}`);
  } catch (error) {
    console.warn(`[Session] Failed to cleanup workspace ${issueKey}:`, error);
  }
}

/**
 * Get the count of active sessions.
 * Counts workspaces that have a corresponding Claude session in
 * ~/.claude/projects/{encoded-path}.
 */
export async function getSessionCount(): Promise<number> {
  const workspacesDir = getWorkspacesDir();
  try {
    await fs.mkdir(workspacesDir, { recursive: true });
    const entries = await fs.readdir(workspacesDir, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const workDir = path.join(workspacesDir, entry.name);
        if (await hasExistingSession(workDir)) {
          count++;
        }
      }
    }

    return count;
  } catch {
    return 0;
  }
}

/**
 * Get the prune threshold in days.
 * Reads from Redis config, falling back to env var / default.
 */
export async function getPruneThresholdDays(): Promise<number> {
  const config = await getConfig();
  return config.pruneThresholdDays;
}

/**
 * Get the prune interval in days.
 * Reads from Redis config, falling back to env var / default.
 */
export async function getPruneIntervalDays(): Promise<number> {
  const config = await getConfig();
  return config.pruneIntervalDays;
}

/**
 * Evict the oldest (least recently used) session to free a slot.
 * Returns the evicted issue key, or null if no sessions to evict.
 */
export async function evictOldestSession(): Promise<string | null> {
  const oldest = await getOldestSession();
  if (!oldest) return null;

  console.log(
    `[Session] Evicting oldest session: ${oldest.issueKey} (last used: ${oldest.lastUsed.toISOString()})`,
  );
  await cleanupWorkspace(oldest.issueKey);
  return oldest.issueKey;
}

/**
 * Prune all sessions whose lastUsed is older than the given threshold.
 * Returns the list of pruned issue keys.
 */
export async function pruneInactiveSessions(
  thresholdDays: number,
): Promise<string[]> {
  const sessions = await listSessions();
  const cutoff = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;
  const pruned: string[] = [];

  for (const session of sessions) {
    if (session.lastUsed.getTime() < cutoff) {
      console.log(
        `[Session] Pruning inactive session: ${session.issueKey} (last used: ${session.lastUsed.toISOString()})`,
      );
      await cleanupWorkspace(session.issueKey);
      pruned.push(session.issueKey);
    }
  }

  if (pruned.length > 0) {
    console.log(
      `[Session] Pruned ${pruned.length} inactive session(s): ${pruned.join(", ")}`,
    );
  }

  return pruned;
}

/**
 * Calculate directory size recursively
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  let size = 0;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += await getDirectorySize(fullPath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        size += stat.size;
      }
    }
  } catch {
    // Ignore errors (permission issues, etc.)
  }

  return size;
}

/**
 * List all sessions with their metadata
 */
export async function listSessions(): Promise<SessionInfo[]> {
  const sessions: SessionInfo[] = [];
  const workspacesDir = getWorkspacesDir();

  try {
    await fs.mkdir(workspacesDir, { recursive: true });
    const entries = await fs.readdir(workspacesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const issueKey = entry.name;
      const workspacePath = path.join(workspacesDir, issueKey);
      const markerPath = path.join(workspacePath, ".dexter-last-used");

      // Get workspace stats
      let createdAt = new Date();
      let lastUsed = new Date();
      let sizeBytes = 0;

      try {
        const workspaceStat = await fs.stat(workspacePath);
        createdAt = workspaceStat.birthtime;
      } catch {
        // Use default
      }

      try {
        const markerContent = await fs.readFile(markerPath, "utf-8");
        lastUsed = new Date(markerContent.trim());
      } catch {
        // Fall back to workspace mtime
        try {
          const workspaceStat = await fs.stat(workspacePath);
          lastUsed = workspaceStat.mtime;
        } catch {
          // Use default
        }
      }

      // Check Claude's session dir in ~/.claude/projects/
      const hasSession = await hasExistingSession(workspacePath);

      // Calculate size from the Claude session dir
      if (hasSession) {
        const sessionDir = getClaudeSessionDir(workspacePath);
        sizeBytes = await getDirectorySize(sessionDir);
      }

      sessions.push({
        issueKey,
        workspacePath,
        createdAt,
        lastUsed,
        hasSession,
        sizeBytes,
      });
    }

    // Sort by last used (most recent first)
    sessions.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());
  } catch {
    // Return empty array if workspaces dir doesn't exist
  }

  return sessions;
}

/**
 * Get the oldest session (least recently used)
 * Used by evictOldestSession() for soft cap LRU eviction
 */
export async function getOldestSession(): Promise<SessionInfo | null> {
  const sessions = await listSessions();
  const activeSessions = sessions.filter((s) => s.hasSession);

  if (activeSessions.length === 0) return null;

  // Sort by last used ascending (oldest first)
  activeSessions.sort((a, b) => a.lastUsed.getTime() - b.lastUsed.getTime());

  return activeSessions[0];
}

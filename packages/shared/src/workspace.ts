import fs from "fs/promises";
import path from "path";
import { getBotName } from "./config.js";

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
 * Get the workspaces directory path (reads from env at runtime)
 */
export function getWorkspacesDir(): string {
  return process.env.WORKSPACES_DIR || `/tmp/${getBotName()}-workspaces`;
}

/**
 * Get the max sessions limit (reads from env at runtime)
 */
export function getMaxSessions(): number {
  return parseInt(process.env.MAX_SESSIONS || "5", 10);
}

/**
 * Get the slot poll interval (reads from env at runtime)
 */
function getSlotPollIntervalMs(): number {
  return parseInt(process.env.SESSION_POLL_INTERVAL_MS || "5000", 10);
}

/**
 * Get or create a persistent workspace for an issue
 */
export async function getOrCreateWorkspace(issueKey: string): Promise<string> {
  const workspacesDir = getWorkspacesDir();
  const workDir = path.join(workspacesDir, issueKey);
  await fs.mkdir(workDir, { recursive: true });

  // Update last used time by touching a marker file
  const markerPath = path.join(workDir, ".dexter-last-used");
  await fs.writeFile(markerPath, new Date().toISOString());

  return workDir;
}

/**
 * Check if a workspace has an existing Claude session
 */
export async function hasExistingSession(workDir: string): Promise<boolean> {
  const claudeDir = path.join(workDir, ".claude");
  try {
    const stat = await fs.stat(claudeDir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a workspace exists for an issue key
 */
export async function workspaceExists(issueKey: string): Promise<boolean> {
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
 * Clean up a workspace by issue key
 */
export async function cleanupWorkspace(issueKey: string): Promise<void> {
  const workspacesDir = getWorkspacesDir();
  const workDir = path.join(workspacesDir, issueKey);
  try {
    await fs.rm(workDir, { recursive: true, force: true });
    console.log(`[Session] Cleaned up workspace for ${issueKey}`);
  } catch (error) {
    console.warn(`[Session] Failed to cleanup workspace ${issueKey}:`, error);
  }
}

/**
 * Get the count of active sessions (workspaces with .claude directories)
 */
export async function getSessionCount(): Promise<number> {
  const workspacesDir = getWorkspacesDir();
  try {
    await fs.mkdir(workspacesDir, { recursive: true });
    const entries = await fs.readdir(workspacesDir, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const claudeDir = path.join(workspacesDir, entry.name, ".claude");
        try {
          const stat = await fs.stat(claudeDir);
          if (stat.isDirectory()) {
            count++;
          }
        } catch {
          // No .claude directory, doesn't count as active session
        }
      }
    }

    return count;
  } catch {
    return 0;
  }
}

/**
 * Check if we can create a new session (under the limit)
 */
export async function canCreateSession(): Promise<boolean> {
  const count = await getSessionCount();
  const maxSessions = getMaxSessions();
  return count < maxSessions;
}

/**
 * Wait for a session slot to become available
 * Polls until a slot opens up
 */
export async function waitForSessionSlot(
  timeoutMs: number = 300000, // 5 minute default timeout
): Promise<void> {
  const startTime = Date.now();
  const maxSessions = getMaxSessions();
  const pollInterval = getSlotPollIntervalMs();

  while (!(await canCreateSession())) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(
        `Timeout waiting for session slot after ${timeoutMs}ms. Max sessions: ${maxSessions}`,
      );
    }

    console.log(
      `[Session] At max capacity (${maxSessions}), waiting for slot...`,
    );
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
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
      const claudeDir = path.join(workspacePath, ".claude");
      const markerPath = path.join(workspacePath, ".dexter-last-used");

      // Get workspace stats
      let createdAt = new Date();
      let lastUsed = new Date();
      let hasSession = false;
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

      try {
        const stat = await fs.stat(claudeDir);
        hasSession = stat.isDirectory();
      } catch {
        hasSession = false;
      }

      // Calculate size (only for .claude dir to keep it fast)
      if (hasSession) {
        sizeBytes = await getDirectorySize(claudeDir);
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
 * Useful for potential LRU eviction in the future
 */
export async function getOldestSession(): Promise<SessionInfo | null> {
  const sessions = await listSessions();
  const activeSessions = sessions.filter((s) => s.hasSession);

  if (activeSessions.length === 0) return null;

  // Sort by last used ascending (oldest first)
  activeSessions.sort((a, b) => a.lastUsed.getTime() - b.lastUsed.getTime());

  return activeSessions[0];
}

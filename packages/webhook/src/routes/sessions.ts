import { Router } from "express";
import {
  listSessions,
  getMaxSessions,
  getWorkspacesDir,
  type SessionInfo,
} from "@mapthew/shared/workspace";
import type { SessionCleanupJob } from "@mapthew/shared/types";
import { queue } from "../config.js";

const router: Router = Router();

/**
 * GET /api/sessions - List all sessions
 *
 * Returns session information for monitoring/dashboard integration.
 */
router.get("/", async (_req, res) => {
  try {
    const sessions = await listSessions();
    const activeSessions = sessions.filter((s: SessionInfo) => s.hasSession);
    const count = activeSessions.length;
    const max = getMaxSessions();

    res.json({
      count,
      max,
      available: max - count,
      workspacesDir: getWorkspacesDir(),
      sessions: sessions.map((s: SessionInfo) => ({
        issueKey: s.issueKey,
        workspacePath: s.workspacePath,
        createdAt: s.createdAt.toISOString(),
        lastUsed: s.lastUsed.toISOString(),
        hasSession: s.hasSession,
        sizeBytes: s.sizeBytes,
        sizeMB: Math.round((s.sizeBytes / 1024 / 1024) * 100) / 100,
      })),
    });
  } catch (error) {
    console.error("Error listing sessions:", error);
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

/**
 * GET /api/sessions/stats - Get session statistics
 */
router.get("/stats", async (_req, res) => {
  try {
    const sessions = await listSessions();
    const max = getMaxSessions();

    const activeSessions = sessions.filter((s: SessionInfo) => s.hasSession);
    const count = activeSessions.length;
    const totalSize = activeSessions.reduce((sum: number, s: SessionInfo) => sum + s.sizeBytes, 0);

    res.json({
      total: sessions.length,
      active: count,
      max,
      available: max - count,
      utilizationPercent: Math.round((count / max) * 100),
      totalSizeBytes: totalSize,
      totalSizeMB: Math.round((totalSize / 1024 / 1024) * 100) / 100,
    });
  } catch (error) {
    console.error("Error getting session stats:", error);
    res.status(500).json({ error: "Failed to get session stats" });
  }
});

/**
 * DELETE /api/sessions/:issueKey - Delete a specific session
 *
 * Queues a cleanup job for the specified session.
 */
router.delete("/:issueKey", async (req, res) => {
  const { issueKey } = req.params;

  if (!issueKey) {
    return res.status(400).json({ error: "issueKey is required" });
  }

  try {
    // Queue a cleanup job
    const cleanupJob: SessionCleanupJob = {
      type: "session-cleanup",
      issueKey,
      reason: "manual",
    };

    await queue.add("session-cleanup", cleanupJob, {
      attempts: 1,
    });

    console.log(`[Session] Manual cleanup queued for ${issueKey}`);

    res.json({
      success: true,
      message: `Cleanup queued for ${issueKey}`,
    });
  } catch (error) {
    console.error(`Error queuing cleanup for ${issueKey}:`, error);
    res.status(500).json({ error: "Failed to queue cleanup" });
  }
});

export default router;

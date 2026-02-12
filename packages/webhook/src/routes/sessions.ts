import { Router } from "express";
import {
  listSessions,
  getMaxSessions,
  getPruneThresholdDays,
  getSessionSizes,
  cleanupWorkspace,
  type SessionInfo,
  type SessionSizeInfo,
} from "@mapthew/shared/workspace";

const router: Router = Router();

/**
 * GET /api/sessions - List all sessions (fast, no size calculation)
 *
 * Returns session information for monitoring/dashboard integration.
 * Sizes are omitted for speed — use GET /api/sessions/sizes separately.
 */
router.get("/", async (_req, res) => {
  try {
    const sessions = await listSessions();
    const activeSessions = sessions.filter((s: SessionInfo) => s.hasSession);
    const count = activeSessions.length;
    const softCap = await getMaxSessions();
    const pruneThresholdDays = await getPruneThresholdDays();

    res.json({
      count,
      softCap,
      available: Math.max(0, softCap - count),
      pruneThresholdDays,
      sessions: sessions.map((s: SessionInfo) => ({
        issueKey: s.issueKey,
        createdAt: s.createdAt.toISOString(),
        lastUsed: s.lastUsed.toISOString(),
        hasSession: s.hasSession,
      })),
    });
  } catch (error) {
    console.error("Error listing sessions:", error);
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

/**
 * GET /api/sessions/sizes - Get sizes for all sessions (slow, async)
 *
 * Calculates directory sizes recursively. Called separately so the
 * sessions page can render immediately while sizes load in the background.
 */
router.get("/sizes", async (_req, res) => {
  try {
    const sizes = await getSessionSizes();

    res.json({
      sizes: sizes.map((s: SessionSizeInfo) => ({
        issueKey: s.issueKey,
        sizeBytes: s.sizeBytes,
        sizeMB: Math.round((s.sizeBytes / 1024 / 1024) * 100) / 100,
        workspaceSizeBytes: s.workspaceSizeBytes,
        workspaceSizeMB:
          Math.round((s.workspaceSizeBytes / 1024 / 1024) * 100) / 100,
      })),
    });
  } catch (error) {
    console.error("Error getting session sizes:", error);
    res.status(500).json({ error: "Failed to get session sizes" });
  }
});

/**
 * GET /api/sessions/stats - Get session statistics
 */
router.get("/stats", async (_req, res) => {
  try {
    const sessions = await listSessions();
    const softCap = await getMaxSessions();
    const pruneThresholdDays = await getPruneThresholdDays();

    const activeSessions = sessions.filter((s: SessionInfo) => s.hasSession);
    const count = activeSessions.length;

    res.json({
      total: sessions.length,
      active: count,
      softCap,
      available: Math.max(0, softCap - count),
      pruneThresholdDays,
      utilizationPercent: softCap > 0 ? Math.round((count / softCap) * 100) : 0,
    });
  } catch (error) {
    console.error("Error getting session stats:", error);
    res.status(500).json({ error: "Failed to get session stats" });
  }
});

/**
 * DELETE /api/sessions/:issueKey - Delete a specific session
 *
 * Directly removes the workspace and Claude session data.
 */
router.delete("/:issueKey", async (req, res) => {
  const { issueKey } = req.params;

  if (!issueKey) {
    return res.status(400).json({ error: "issueKey is required" });
  }

  try {
    await cleanupWorkspace(issueKey);
    console.log(`[Session] Manual cleanup completed for ${issueKey}`);

    res.json({
      success: true,
      message: `Session cleaned up for ${issueKey}`,
    });
  } catch (error) {
    console.error(`Error cleaning up session ${issueKey}:`, error);
    res.status(500).json({ error: "Failed to clean up session" });
  }
});

export default router;

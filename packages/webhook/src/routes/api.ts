import { Router } from "express";
import { queue } from "../config.js";
import { getConfig, saveConfig, getBotDisplayName, type AppConfig } from "@mapthew/shared";

const router: Router = Router();

// ============================================
// Queue endpoints
// ============================================

// GET /api/queue - Queue stats
router.get("/queue", async (_req, res) => {
  try {
    const counts = await queue.getJobCounts();
    res.json({
      name: queue.name,
      counts: {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
      },
    });
  } catch (error) {
    console.error("Error getting queue stats:", error);
    res.status(500).json({ error: "Failed to get queue stats" });
  }
});

// GET /api/queue/jobs - List jobs
router.get("/queue/jobs", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const statuses = status
      ? [status as "waiting" | "active" | "completed" | "failed" | "delayed"]
      : (["waiting", "active", "completed", "failed", "delayed"] as const);

    const jobs = await queue.getJobs([...statuses], 0, limit - 1);

    const jobData = jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      status: job.finishedOn
        ? job.failedReason
          ? "failed"
          : "completed"
        : job.processedOn
        ? "active"
        : job.delay && job.delay > 0
        ? "delayed"
        : "waiting",
      progress: job.progress ?? 0,
      attemptsMade: job.attemptsMade ?? 0,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
    }));

    res.json(jobData);
  } catch (error) {
    console.error("Error getting jobs:", error);
    res.status(500).json({ error: "Failed to get jobs" });
  }
});

// GET /api/queue/jobs/:id - Get single job
router.get("/queue/jobs/:id", async (req, res) => {
  try {
    const job = await queue.getJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    res.json({
      id: job.id,
      name: job.name,
      data: job.data,
      status: job.finishedOn
        ? job.failedReason
          ? "failed"
          : "completed"
        : job.processedOn
        ? "active"
        : job.delay && job.delay > 0
        ? "delayed"
        : "waiting",
      progress: job.progress ?? 0,
      attemptsMade: job.attemptsMade ?? 0,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
    });
  } catch (error) {
    console.error("Error getting job:", error);
    res.status(500).json({ error: "Failed to get job" });
  }
});

// POST /api/queue/jobs/:id/retry - Retry failed job
router.post("/queue/jobs/:id/retry", async (req, res) => {
  try {
    const job = await queue.getJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    await job.retry();
    res.json({ success: true });
  } catch (error) {
    console.error("Error retrying job:", error);
    res.status(500).json({ error: "Failed to retry job" });
  }
});

// DELETE /api/queue/jobs/:id - Remove job
router.delete("/queue/jobs/:id", async (req, res) => {
  try {
    const job = await queue.getJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    await job.remove();
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing job:", error);
    res.status(500).json({ error: "Failed to remove job" });
  }
});

// ============================================
// Config endpoints
// ============================================

// GET /api/config
router.get("/config", async (_req, res) => {
  try {
    const config = await getConfig();
    res.json({ botName: config.botName, botDisplayName: getBotDisplayName() });
  } catch (error) {
    console.error("Error getting config:", error);
    res.status(500).json({ error: "Failed to get config" });
  }
});

// PUT /api/config
router.put("/config", async (req, res) => {
  try {
    const { botName } = req.body as Partial<AppConfig>;

    if (botName !== undefined) {
      const config = await getConfig();
      config.botName = botName;
      await saveConfig(config);
    }

    const updatedConfig = await getConfig();
    res.json({ botName: updatedConfig.botName, botDisplayName: getBotDisplayName() });
  } catch (error) {
    console.error("Error updating config:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;

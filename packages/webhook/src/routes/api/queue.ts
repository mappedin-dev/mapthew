import { Router } from "express";
import { queue } from "../../config.js";
import { type AdminJob, type QueueStats, type JobData, type AdminJobContext } from "@mapthew/shared/types";

const router: Router = Router();

// GET /api/queue - Queue stats
router.get("/", async (_req, res) => {
  try {
    const counts = await queue.getJobCounts();
    const stats: QueueStats = {
      name: queue.name,
      counts: {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
      },
    };
    res.json(stats);
  } catch (error) {
    console.error("Error getting queue stats:", error);
    res.status(500).json({ error: "Failed to get queue stats" });
  }
});

// GET /api/queue/jobs - List jobs
router.get("/jobs", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const statuses = status
      ? [status as "waiting" | "active" | "completed" | "failed" | "delayed"]
      : (["waiting", "active", "completed", "failed", "delayed"] as const);

    const jobs = await queue.getJobs([...statuses], 0, limit - 1);

    const jobData: JobData[] = await Promise.all(
      jobs.map(async (job) => {
        const status = await job.getState();
        return {
          id: job.id!,
          name: job.name,
          data: JSON.stringify(job.data),
          status: status === "unknown" ? "waiting" : status, // Treat unknown as waiting
          progress: job.progress ?? 0,
          attemptsMade: job.attemptsMade ?? 0,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          failedReason: job.failedReason ?? "",
          returnvalue: JSON.stringify(job.returnvalue ?? null),
        };
      })
    );

    res.json(jobData);
  } catch (error) {
    console.error("Error getting jobs:", error);
    res.status(500).json({ error: "Failed to get jobs" });
  }
});

// GET /api/queue/jobs/:id - Get single job
router.get("/jobs/:id", async (req, res) => {
  try {
    const job = await queue.getJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    const status = await job.getState();
    const jobData: JobData = {
      id: job.id!,
      name: job.name,
      data: JSON.stringify(job.data),
      status: status === "unknown" ? "waiting" : status, // Treat unknown as waiting
      progress: job.progress ?? 0,
      attemptsMade: job.attemptsMade ?? 0,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason ?? "",
      returnvalue: JSON.stringify(job.returnvalue ?? null),
    };
    res.json(jobData);
  } catch (error) {
    console.error("Error getting job:", error);
    res.status(500).json({ error: "Failed to get job" });
  }
});

// POST /api/queue/jobs/:id/retry - Retry failed job
router.post("/jobs/:id/retry", async (req, res) => {
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
router.delete("/jobs/:id", async (req, res) => {
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

// POST /api/queue/jobs - Create admin job
router.post("/jobs", async (req, res) => {
  try {
    const { instruction, ...context } = req.body as { instruction?: string } & AdminJobContext;

    if (!instruction || typeof instruction !== "string") {
      res.status(400).json({ error: "instruction is required" });
      return;
    }

    const job: AdminJob = {
      source: "admin",
      instruction: instruction.trim(),
      triggeredBy: "admin",
      ...context,
    };

    const bullJob = await queue.add("process-ticket", job, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });

    console.log(`Admin job queued: ${bullJob.id}`);
    res.json({ success: true, jobId: bullJob.id });
  } catch (error) {
    console.error("Error creating job:", error);
    res.status(500).json({ error: "Failed to create job" });
  }
});

export default router;

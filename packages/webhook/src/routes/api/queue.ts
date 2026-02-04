import { Router } from "express";
import { queue } from "../../config.js";
import { type AdminJob } from "@mapthew/shared";

const router: Router = Router();

// GET /api/queue - Queue stats
router.get("/", async (_req, res) => {
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
router.get("/jobs", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const statuses = status
      ? [status as "waiting" | "active" | "completed" | "failed" | "delayed"]
      : (["waiting", "active", "completed", "failed", "delayed"] as const);

    const jobs = await queue.getJobs([...statuses], 0, limit - 1);

    const jobData = await Promise.all(
      jobs.map(async (job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        status: await job.getState(),
        progress: job.progress ?? 0,
        attemptsMade: job.attemptsMade ?? 0,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
        returnvalue: job.returnvalue,
      }))
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

    res.json({
      id: job.id,
      name: job.name,
      data: job.data,
      status: await job.getState(),
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
    const {
      instruction,
      jiraBoardId,
      jiraIssueKey,
      githubOwner,
      githubRepo,
      githubBranchId,
      githubPrNumber,
      githubIssueNumber,
    } = req.body as {
      instruction?: string;
      jiraBoardId?: string;
      jiraIssueKey?: string;
      githubOwner?: string;
      githubRepo?: string;
      githubBranchId?: string;
      githubPrNumber?: number;
      githubIssueNumber?: number;
    };

    if (!instruction || typeof instruction !== "string") {
      res.status(400).json({ error: "instruction is required" });
      return;
    }

    const job: AdminJob = {
      source: "admin",
      instruction: instruction.trim(),
      triggeredBy: "admin",
      // Optional JIRA context
      ...(jiraBoardId && { jiraBoardId }),
      ...(jiraIssueKey && { jiraIssueKey }),
      // Optional GitHub context
      ...(githubOwner && { githubOwner }),
      ...(githubRepo && { githubRepo }),
      ...(githubBranchId && { githubBranchId }),
      ...(githubPrNumber && { githubPrNumber }),
      ...(githubIssueNumber && { githubIssueNumber }),
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

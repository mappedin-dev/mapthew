import { createWorker, type BullJob } from "@mapthew/shared/queue";
import type { Job } from "@mapthew/shared/types";
import { isAdminJob, isGitHubJob, isJiraJob, getBotName } from "@mapthew/shared/utils";
import { postGitHubComment, postJiraComment } from "@mapthew/shared/api";
import { invokeClaudeCode } from "./claude.js";
import { getReadableId } from "./utils.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "";
const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

// JIRA credentials for posting comments
const jiraCredentials = {
  baseUrl: JIRA_BASE_URL,
  email: JIRA_EMAIL,
  apiToken: JIRA_API_TOKEN,
};

/**
 * Post a comment to the appropriate source (JIRA or GitHub)
 */
async function postComment(job: Job, comment: string): Promise<void> {
  if (isGitHubJob(job)) {
    const number = job.prNumber ?? job.issueNumber;
    if (number) {
      await postGitHubComment(
        GITHUB_TOKEN,
        job.owner,
        job.repo,
        number,
        comment
      );
    }
  } else if (isJiraJob(job)) {
    await postJiraComment(jiraCredentials, job.issueKey, comment);
  } else if (isAdminJob(job)) {
    // Admin jobs don't have an external source to post comments to
    // Status is visible on the dashboard
  }
}

/**
 * Create a temporary workspace directory
 */
async function createTempWorkspace(jobId: string): Promise<string> {
  // Sanitize jobId for filesystem (replace / with -)
  const sanitized = jobId.replace(/\//g, "-");
  const tempDir = path.join(
    os.tmpdir(),
    `${getBotName()}-${sanitized}-${Date.now()}`
  );
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Clean up a workspace directory
 */
async function cleanupWorkspace(workDir: string): Promise<void> {
  try {
    await fs.rm(workDir, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Failed to cleanup workspace ${workDir}:`, error);
  }
}

/**
 * Process a job
 */
async function processJob(bullJob: BullJob<Job>): Promise<void> {
  const job = bullJob.data;
  const jobId = getReadableId(job);
  console.log(`Processing job for ${jobId}: ${job.instruction}`);

  const workDir = await createTempWorkspace(jobId);
  console.log(`Created workspace: ${workDir}`);

  try {
    const result = await invokeClaudeCode(job, workDir);

    if (!result.success) {
      throw new Error(result.error || "Claude Code CLI failed");
    }

    console.log(`Job completed for ${jobId}`);
  } finally {
    await cleanupWorkspace(workDir);
    console.log(`Cleaned up workspace: ${workDir}`);
  }
}

// Create worker
const worker = createWorker(REDIS_URL, processJob);

// Handle failed jobs - post error to appropriate source
worker.on("failed", async (job, err) => {
  if (job) {
    console.error(`Job failed for ${getReadableId(job.data)}:`, err.message);
    await postComment(job.data, `🤓 Oops, I hit an error: ${err.message}`);
  }
});

// Handle completed jobs
worker.on("completed", (job) => {
  console.log(`Job completed: ${getReadableId(job.data)}`);
});

console.log("Worker started, waiting for jobs...");

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down worker...");
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Shutting down worker...");
  await worker.close();
  process.exit(0);
});

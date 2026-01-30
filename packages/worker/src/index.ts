import {
  createWorker,
  createJiraClient,
  type BullJob,
  isGitHubJob,
  isJiraJob,
  postGitHubComment,
  postJiraComment,
  type Job,
  getBotName,
} from "@mapthew/shared";
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

// Post-processing configuration
const JIRA_LABEL_ADD = process.env.JIRA_LABEL_ADD || "claude-processed";
const JIRA_LABEL_REMOVE = process.env.JIRA_LABEL_REMOVE || "claude-ready";
const JIRA_DONE_STATUS = process.env.JIRA_DONE_STATUS || "";

// Initialize JIRA client for post-processing
const jiraClient =
  JIRA_BASE_URL && JIRA_EMAIL && JIRA_API_TOKEN
    ? createJiraClient({
        baseUrl: JIRA_BASE_URL,
        email: JIRA_EMAIL,
        apiToken: JIRA_API_TOKEN,
      })
    : null;

/**
 * Post a comment to the appropriate source (JIRA or GitHub)
 */
async function postComment(job: Job, comment: string): Promise<void> {
  if (isGitHubJob(job)) {
    await postGitHubComment(
      GITHUB_TOKEN,
      job.owner,
      job.repo,
      job.prNumber,
      comment
    );
  } else if (isJiraJob(job)) {
    await postJiraComment(jiraCredentials, job.issueKey, comment);
  }
}

/**
 * Post-process a JIRA issue after successful job completion
 * - Add label (default: claude-processed)
 * - Remove label (default: claude-ready)
 * - Transition to status (if configured)
 */
async function postProcessJiraIssue(issueKey: string): Promise<void> {
  if (!jiraClient) return;

  // Update labels (independent of transition)
  const labelsToAdd = JIRA_LABEL_ADD ? [JIRA_LABEL_ADD.trim()] : [];
  const labelsToRemove = JIRA_LABEL_REMOVE ? [JIRA_LABEL_REMOVE.trim()] : [];

  if (labelsToAdd.length > 0 || labelsToRemove.length > 0) {
    try {
      await jiraClient.updateLabels(issueKey, {
        add: labelsToAdd,
        remove: labelsToRemove,
      });
      console.log(
        `Updated labels for ${issueKey}: +${labelsToAdd.join(",")} -${labelsToRemove.join(",")}`,
      );
    } catch (error) {
      console.error(`Failed to update labels for ${issueKey}:`, error);
    }
  }

  // Transition to configured status (independent of labels)
  const doneStatus = JIRA_DONE_STATUS?.trim();
  if (doneStatus) {
    try {
      const success = await jiraClient.transitionTo(issueKey, doneStatus);
      if (success) {
        console.log(`Transitioned ${issueKey} to "${doneStatus}"`);
      }
    } catch (error) {
      console.error(`Failed to transition ${issueKey}:`, error);
    }
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

    // Post-process JIRA issues: update labels and transition status
    if (isJiraJob(job)) {
      await postProcessJiraIssue(job.issueKey);
    }
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

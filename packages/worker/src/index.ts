import {
  createWorker,
  type BullJob,
  isGitHubJob,
  isJiraJob,
  isSessionCleanupJob,
  postGitHubComment,
  postJiraComment,
  type Job,
  type QueueJob,
  getOrCreateWorkspace,
  hasExistingSession,
  canCreateSession,
  waitForSessionSlot,
  workspaceExists,
  cleanupWorkspace,
  getMaxSessions,
  getS3Config,
  isS3StorageEnabled,
  archiveSessionToS3,
  restoreSessionFromS3,
  deleteSessionFromS3,
} from "@dexter/shared";
import { invokeClaudeCode } from "./claude.js";
import { getReadableId, getIssueKey } from "./utils.js";

// Log S3 storage status at startup
const s3Config = getS3Config();
if (s3Config) {
  console.log(
    `[S3] Session storage enabled: s3://${s3Config.bucket}/${s3Config.prefix || "sessions"}`,
  );
} else {
  console.log("[S3] Session storage disabled (S3_SESSIONS_BUCKET not set)");
}

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
    await postGitHubComment(
      GITHUB_TOKEN,
      job.owner,
      job.repo,
      job.prNumber,
      comment,
    );
  } else if (isJiraJob(job)) {
    await postJiraComment(jiraCredentials, job.issueKey, comment);
  }
}

/**
 * Try to restore a session from S3 if configured and no local session exists
 */
async function tryRestoreFromS3(workDir: string, issueKey: string): Promise<boolean> {
  const config = getS3Config();
  if (!config) {
    return false;
  }

  try {
    const restored = await restoreSessionFromS3(config, workDir, issueKey);
    if (restored) {
      console.log(`[S3] Successfully restored session for ${issueKey}`);
    }
    return restored;
  } catch (error) {
    console.warn(`[S3] Failed to restore session for ${issueKey}:`, error);
    return false;
  }
}

/**
 * Archive a session to S3 if configured
 */
async function tryArchiveToS3(workDir: string, issueKey: string): Promise<void> {
  const config = getS3Config();
  if (!config) {
    return;
  }

  try {
    await archiveSessionToS3(config, workDir, issueKey);
  } catch (error) {
    // Log but don't fail the job - archiving is best-effort
    console.warn(`[S3] Failed to archive session for ${issueKey}:`, error);
  }
}

/**
 * Delete a session from S3 if configured
 */
async function tryDeleteFromS3(issueKey: string): Promise<void> {
  const config = getS3Config();
  if (!config) {
    return;
  }

  try {
    await deleteSessionFromS3(config, issueKey);
  } catch (error) {
    console.warn(`[S3] Failed to delete session for ${issueKey}:`, error);
  }
}

/**
 * Process a regular job using persistent workspaces for session reuse
 */
async function processRegularJob(job: Job): Promise<void> {
  const jobId = getReadableId(job);
  const issueKey = getIssueKey(job);

  console.log(`Processing job for ${jobId}: ${job.instruction}`);
  console.log(`[Session] Issue key: ${issueKey}`);

  // Check if this job can reuse an existing session
  const hasExisting = await workspaceExists(issueKey);

  // If no existing workspace and we're at capacity, wait for a slot
  if (!hasExisting && !(await canCreateSession())) {
    console.log(
      `[Session] At max capacity (${getMaxSessions()}), waiting for slot...`,
    );
    await waitForSessionSlot();
    console.log(`[Session] Slot available, proceeding`);
  }

  // Get or create the persistent workspace
  const workDir = await getOrCreateWorkspace(issueKey);
  console.log(`[Session] Workspace: ${workDir}`);

  // Check if there's an existing Claude session to resume
  let hasSession = await hasExistingSession(workDir);

  // If no local session exists, try to restore from S3
  if (!hasSession && isS3StorageEnabled()) {
    console.log(`[S3] Checking for session in S3...`);
    const restored = await tryRestoreFromS3(workDir, issueKey);
    if (restored) {
      hasSession = true;
    }
  }

  if (hasSession) {
    console.log(`[Session] Found existing session, will resume`);
  } else {
    console.log(`[Session] No existing session, starting fresh`);
  }

  // Invoke Claude with session context
  const result = await invokeClaudeCode(job, workDir, { hasSession });

  if (!result.success) {
    throw new Error(result.error || "Claude Code CLI failed");
  }

  // Archive session to S3 after successful completion
  await tryArchiveToS3(workDir, issueKey);

  console.log(`Job completed for ${jobId}`);
  // Note: We intentionally do NOT clean up the workspace here
  // Workspaces are cleaned up when PRs are merged or manually
}

/**
 * Process all job types (regular jobs and cleanup jobs)
 */
async function processJob(bullJob: BullJob<QueueJob>): Promise<void> {
  const job = bullJob.data;

  // Handle session cleanup jobs
  if (isSessionCleanupJob(job)) {
    console.log(
      `[Session] Processing cleanup for ${job.issueKey} (reason: ${job.reason})`,
    );

    // Clean up local workspace
    await cleanupWorkspace(job.issueKey);

    // Also delete from S3 if configured
    await tryDeleteFromS3(job.issueKey);

    return;
  }

  // Handle regular jobs
  await processRegularJob(job);
}

// Create worker
const worker = createWorker(REDIS_URL, processJob);

// Handle failed jobs - post error to appropriate source
worker.on("failed", async (job, err) => {
  if (job) {
    const data = job.data as QueueJob;

    // Don't post comments for cleanup job failures
    if (isSessionCleanupJob(data)) {
      console.error(
        `[Session] Cleanup failed for ${data.issueKey}:`,
        err.message,
      );
      return;
    }

    console.error(`Job failed for ${getReadableId(data)}:`, err.message);
    await postComment(data, `🤓 Oops, I hit an error: ${err.message}`);
  }
});

// Handle completed jobs
worker.on("completed", (job) => {
  const data = job.data as QueueJob;

  if (isSessionCleanupJob(data)) {
    console.log(`[Session] Cleanup completed: ${data.issueKey}`);
    return;
  }

  console.log(`Job completed: ${getReadableId(data)}`);
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

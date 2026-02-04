import {
  createWorker,
  type BullJob,
  isAdminJob,
  isGitHubJob,
  isJiraJob,
  isSessionCleanupJob,
  postGitHubComment,
  postJiraComment,
  type Job,
  type QueueJob,
  getBotName,
  getOrCreateWorkspace,
  hasExistingSession,
  canCreateSession,
  waitForSessionSlot,
  workspaceExists,
  cleanupWorkspace,
  getMaxSessions,
} from "@mapthew/shared";
import { invokeClaudeCode } from "./claude.js";
import { getReadableId, getIssueKey } from "./utils.js";

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
        comment,
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
  const hasSession = await hasExistingSession(workDir);
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
    await cleanupWorkspace(job.issueKey);
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

console.log(`Worker started as @${getBotName()}, waiting for jobs...`);

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

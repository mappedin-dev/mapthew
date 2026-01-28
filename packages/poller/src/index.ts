import { Redis } from "ioredis";
import { createQueue } from "@dexter/shared/queue";
import { type JiraJob, extractDexterInstruction } from "@dexter/shared/types";
import {
  createJiraClient,
  searchRecentlyUpdatedIssues,
  getCommentText,
  type JiraClient,
} from "@dexter/shared/jira";

// Configuration
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "";
const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";
const JIRA_POLL_PROJECTS = process.env.JIRA_POLL_PROJECTS || "";
const JIRA_POLL_INTERVAL_MS = parseInt(
  process.env.JIRA_POLL_INTERVAL_MS || "30000",
  10,
);

// Redis key for tracking processed comments (with 7 day TTL)
const PROCESSED_COMMENTS_KEY = "dexter:processed-comments";
const PROCESSED_COMMENT_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Parse Redis URL into connection options for ioredis
 */
function parseRedisUrl(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 6379,
  };
}

/**
 * Check if a comment has already been processed
 */
async function isCommentProcessed(
  redis: Redis,
  commentId: string,
): Promise<boolean> {
  const result = await redis.sismember(PROCESSED_COMMENTS_KEY, commentId);
  return result === 1;
}

/**
 * Mark a comment as processed
 */
async function markCommentProcessed(
  redis: Redis,
  commentId: string,
): Promise<void> {
  await redis.sadd(PROCESSED_COMMENTS_KEY, commentId);
  // Refresh TTL on the set
  await redis.expire(PROCESSED_COMMENTS_KEY, PROCESSED_COMMENT_TTL);
}

/**
 * Process comments for an issue, queueing jobs for @dexter mentions
 */
async function processIssueComments(
  jiraClient: JiraClient,
  issueKey: string,
  redis: Redis,
  queue: ReturnType<typeof createQueue>,
): Promise<number> {
  const commentsResult = await jiraClient.getIssueComments(issueKey);
  let jobsQueued = 0;

  for (const comment of commentsResult.comments) {
    // Skip already processed comments
    if (await isCommentProcessed(redis, comment.id)) {
      continue;
    }

    // Extract text from comment (handles both string and ADF format)
    const commentText = getCommentText(comment);

    // Check for @dexter mention
    const instruction = extractDexterInstruction(commentText);
    if (instruction) {
      const job: JiraJob = {
        source: "jira",
        issueKey,
        projectKey: issueKey.split("-")[0].toUpperCase(),
        instruction,
        triggeredBy: comment.author.displayName,
      };

      await queue.add("process-ticket", job, {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      });

      console.log(`Job queued for ${issueKey}: ${instruction}`);
      jobsQueued++;
    }

    // Mark comment as processed (even if no @dexter mention)
    await markCommentProcessed(redis, comment.id);
  }

  return jobsQueued;
}

/**
 * Poll JIRA for new comments with @dexter mentions
 */
async function poll(
  jiraClient: JiraClient,
  projects: string[],
  redis: Redis,
  queue: ReturnType<typeof createQueue>,
): Promise<void> {
  // Look back slightly longer than poll interval to avoid missing comments
  const sinceMinutes = Math.ceil((JIRA_POLL_INTERVAL_MS / 1000 / 60) * 2) + 1;

  for (const project of projects) {
    try {
      const issues = await searchRecentlyUpdatedIssues(
        jiraClient,
        project,
        sinceMinutes,
      );

      for (const issue of issues) {
        try {
          await processIssueComments(jiraClient, issue.key, redis, queue);
        } catch (error) {
          console.error(`Error processing comments for ${issue.key}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error polling project ${project}:`, error);
    }
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Validate configuration
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.error("Missing JIRA credentials. Required:");
    console.error("  - JIRA_BASE_URL");
    console.error("  - JIRA_EMAIL");
    console.error("  - JIRA_API_TOKEN");
    process.exit(1);
  }

  if (!JIRA_POLL_PROJECTS) {
    console.error(
      "JIRA_POLL_PROJECTS is required (comma-separated project keys)",
    );
    process.exit(1);
  }

  const projects = JIRA_POLL_PROJECTS.split(",").map((p) => p.trim());
  console.log(`Polling projects: ${projects.join(", ")}`);
  console.log(`Poll interval: ${JIRA_POLL_INTERVAL_MS}ms`);

  // Initialize clients
  const jiraClient = createJiraClient({
    baseUrl: JIRA_BASE_URL,
    email: JIRA_EMAIL,
    apiToken: JIRA_API_TOKEN,
  });

  const redisOptions = parseRedisUrl(REDIS_URL);
  const redis = new Redis(redisOptions);
  const queue = createQueue(REDIS_URL);

  console.log("Poller started, beginning polling loop...");

  // Initial poll immediately
  await poll(jiraClient, projects, redis, queue);

  // Then poll on interval
  setInterval(async () => {
    try {
      await poll(jiraClient, projects, redis, queue);
    } catch (error) {
      console.error("Poll error:", error);
    }
  }, JIRA_POLL_INTERVAL_MS);
}

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down...");
  process.exit(0);
});

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

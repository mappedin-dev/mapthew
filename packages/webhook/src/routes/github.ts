import { Router } from "express";
import type {
  GitHubJob,
  GitHubWebhookPayload,
  GitHubPRPayload,
  GitHubReviewCommentPayload,
  SessionCleanupJob,
} from "@mapthew/shared/types";
import {
  isGitHubPRCommentEvent,
  isGitHubIssueCommentEvent,
  extractBotInstruction,
  extractIssueKeyFromBranch,
  getBotName,
} from "@mapthew/shared/utils";
import { postGitHubComment, fetchGitHubPRDetails } from "@mapthew/shared/api";
import { queue, GITHUB_TOKEN, VERBOSE_LOGS } from "../config.js";
import { githubWebhookAuth } from "../middleware/index.js";

const router: Router = Router();

const REGULAR_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
  priority: 10, // Lower than cleanup jobs so they can free slots first
};

const CLEANUP_JOB_OPTIONS = {
  attempts: 1,
  priority: 1, // High priority — cleanup frees session slots for waiting jobs
};

/**
 * Queue a GitHub job, post an ack comment, and log the action.
 */
async function queueGitHubJob(
  job: GitHubJob,
  commentNumber: number,
  logLabel: string,
): Promise<void> {
  await queue.add("process-ticket", job, REGULAR_JOB_OPTIONS);

  console.log(
    `GitHub Job queued: ${job.owner}/${job.repo}#${commentNumber} (${logLabel}) - ${job.instruction}`,
  );

  await postGitHubComment(
    GITHUB_TOKEN,
    job.owner,
    job.repo,
    commentNumber,
    "🤓 Okie dokie!",
  );
}

/**
 * Handle PR merge events - cleanup session
 */
async function handlePRMerge(payload: GitHubPRPayload): Promise<void> {
  const { login: owner } = payload.repository.owner;
  const repo = payload.repository.name;
  const prNumber = payload.pull_request.number;
  const branchName = payload.pull_request.head.ref;

  // Try to extract issue key from branch name (e.g., "feature/DXTR-123-add-auth")
  const issueKey = extractIssueKeyFromBranch(branchName);

  // Also create cleanup job for the GitHub-based session key
  const ghIssueKey = `gh-${owner}-${repo}-${prNumber}`;

  console.log(
    `[Session] PR #${prNumber} merged in ${owner}/${repo}, branch: ${branchName}`,
  );

  // Queue cleanup for GitHub-based session
  const ghCleanupJob: SessionCleanupJob = {
    type: "session-cleanup",
    issueKey: ghIssueKey,
    reason: "pr-merged",
    owner,
    repo,
    prNumber,
  };

  await queue.add("session-cleanup", ghCleanupJob, CLEANUP_JOB_OPTIONS);

  console.log(`[Session] Queued cleanup for ${ghIssueKey}`);

  // If we found a Jira issue key, queue cleanup for that too
  if (issueKey) {
    const jiraCleanupJob: SessionCleanupJob = {
      type: "session-cleanup",
      issueKey,
      reason: "pr-merged",
      owner,
      repo,
      prNumber,
    };

    await queue.add("session-cleanup", jiraCleanupJob, CLEANUP_JOB_OPTIONS);

    console.log(`[Session] Queued cleanup for ${issueKey}`);
  }
}

/**
 * GitHub webhook endpoint for PR and issue comments and merge events
 */
router.post("/", githubWebhookAuth, async (req, res) => {
  try {
    const event = req.headers["x-github-event"];

    // Handle ping events (sent when webhook is first configured)
    if (event === "ping") {
      return res.status(200).json({ status: "pong" });
    }

    // Handle PR events (merge)
    if (event === "pull_request") {
      const payload = req.body as GitHubPRPayload;

      // Only process closed PRs that were merged
      if (payload.action === "closed" && payload.pull_request?.merged) {
        await handlePRMerge(payload);
        return res.status(200).json({ status: "cleanup-queued" });
      }

      return res.status(200).json({
        status: "ignored",
        reason: "PR not merged or not closed",
      });
    }

    // Handle PR review comments (file-level comments on diffs)
    if (event === "pull_request_review_comment") {
      const payload = req.body as GitHubReviewCommentPayload;

      if (payload.action !== "created") {
        if (VERBOSE_LOGS)
          console.log(
            `GitHub webhook ignored: review comment action "${payload.action}"`,
          );
        return res.status(200).json({
          status: "ignored",
          reason: "review comment not created",
        });
      }

      const instruction = extractBotInstruction(payload.comment.body);
      if (!instruction) {
        if (VERBOSE_LOGS)
          console.log(
            `GitHub webhook ignored: no @${getBotName()} trigger in review comment by ${payload.comment.user.login}`,
          );
        return res.status(200).json({
          status: "ignored",
          reason: `no @${getBotName()} trigger found`,
        });
      }

      const { login: owner } = payload.repository.owner;
      const repo = payload.repository.name;
      const prNumber = payload.pull_request.number;
      const branchName = payload.pull_request.head.ref;
      const filePath = payload.comment.path;

      // Log session linking info
      const issueKey = extractIssueKeyFromBranch(branchName);
      if (issueKey) {
        console.log(
          `[Session] PR #${prNumber} linked to ${issueKey} via branch: ${branchName}`,
        );
      }

      const job: GitHubJob = {
        instruction: `[Review comment on \`${filePath}\`] ${instruction}`,
        triggeredBy: payload.comment.user.login,
        source: "github",
        owner,
        repo,
        prNumber,
        branchName,
      };

      await queueGitHubJob(job, prNumber, `review comment on ${filePath}`);

      return res
        .status(200)
        .json({ status: "queued", number: prNumber, type: "review-comment" });
    }

    // Handle issue_comment events
    if (event !== "issue_comment") {
      if (VERBOSE_LOGS)
        console.log(`GitHub webhook ignored: event type "${event}"`);
      return res
        .status(200)
        .json({ status: "ignored", reason: `event type: ${event}` });
    }

    const payload = req.body as GitHubWebhookPayload;

    const isPR = isGitHubPRCommentEvent(payload);
    const isIssue = isGitHubIssueCommentEvent(payload);

    // Only process new comments on PRs or issues (not edits/deletes)
    if (!isPR && !isIssue) {
      if (VERBOSE_LOGS)
        console.log(
          `GitHub webhook ignored: not a new PR or issue comment (action: ${payload.action})`,
        );
      return res
        .status(200)
        .json({ status: "ignored", reason: "not a new PR or issue comment" });
    }

    const instruction = extractBotInstruction(payload.comment.body);
    if (!instruction) {
      const { login: owner } = payload.repository.owner;
      const repo = payload.repository.name;
      const number = payload.issue.number;
      if (VERBOSE_LOGS)
        console.log(
          `GitHub webhook ignored: no @${getBotName()} trigger in ${owner}/${repo}#${number} comment by ${payload.comment.user.login}`,
        );
      return res.status(200).json({
        status: "ignored",
        reason: `no @${getBotName()} trigger found`,
      });
    }

    const { login: owner } = payload.repository.owner;
    const repo = payload.repository.name;
    const number = payload.issue.number;

    // Fetch PR details to get the branch name for session linking (only for PRs)
    let branchName: string | undefined;
    if (isPR) {
      const prDetails = await fetchGitHubPRDetails(
        GITHUB_TOKEN,
        owner,
        repo,
        number,
      );

      if (!prDetails) {
        console.warn(
          `[Session] Could not fetch PR details for ${owner}/${repo}#${number} — session linking will be skipped`,
        );
      } else {
        branchName = prDetails.branchName;

        // Log session linking info
        const issueKey = extractIssueKeyFromBranch(branchName);
        if (issueKey) {
          console.log(
            `[Session] PR #${number} linked to ${issueKey} via branch: ${branchName}`,
          );
        }
      }
    }

    const job: GitHubJob = {
      instruction,
      triggeredBy: payload.comment.user.login,
      source: "github",
      owner,
      repo,
      prNumber: isPR ? number : undefined,
      issueNumber: isIssue ? number : undefined,
      branchName,
    };

    const type = isPR ? "PR" : "issue";
    await queueGitHubJob(job, number, type);

    return res.status(200).json({ status: "queued", number, type });
  } catch (error) {
    console.error("GitHub webhook error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

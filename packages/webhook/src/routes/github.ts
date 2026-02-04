import { Router } from "express";
import {
  type GitHubJob,
  type GitHubWebhookPayload,
  type SessionCleanupJob,
  isGitHubPRCommentEvent,
  isGitHubIssueCommentEvent,
  extractBotInstruction,
  extractIssueKeyFromBranch,
  postGitHubComment,
  fetchGitHubPRDetails,
  getBotName,
} from "@mapthew/shared";
import { queue, GITHUB_TOKEN } from "../config.js";
import { githubWebhookAuth } from "../middleware/index.js";

const router: Router = Router();

/**
 * GitHub PR merge webhook payload
 */
interface GitHubPRPayload {
  action: string;
  pull_request: {
    number: number;
    merged: boolean;
    head: {
      ref: string; // branch name
    };
  };
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
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

  await queue.add("session-cleanup", ghCleanupJob, {
    attempts: 1,
  });

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

    await queue.add("session-cleanup", jiraCleanupJob, {
      attempts: 1,
    });

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

    // Handle issue_comment events
    if (event !== "issue_comment") {
      return res
        .status(200)
        .json({ status: "ignored", reason: `event type: ${event}` });
    }

    const payload = req.body as GitHubWebhookPayload;

    const isPR = isGitHubPRCommentEvent(payload);
    const isIssue = isGitHubIssueCommentEvent(payload);

    // Only process new comments on PRs or issues (not edits/deletes)
    if (!isPR && !isIssue) {
      return res
        .status(200)
        .json({ status: "ignored", reason: "not a new PR or issue comment" });
    }

    const instruction = extractBotInstruction(payload.comment.body);
    if (!instruction) {
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
      branchName = prDetails?.branchName;

      // Log session linking info
      if (branchName) {
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

    await queue.add("process-ticket", job, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });

    const type = isPR ? "PR" : "issue";
    console.log(
      `GitHub Job queued: ${owner}/${repo}#${number} (${type}) - ${instruction}`,
    );

    await postGitHubComment(
      GITHUB_TOKEN,
      owner,
      repo,
      number,
      "🤓 Okie dokie!",
    );

    return res.status(200).json({ status: "queued", number, type });
  } catch (error) {
    console.error("GitHub webhook error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

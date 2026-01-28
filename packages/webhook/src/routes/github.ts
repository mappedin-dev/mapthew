import { Router } from "express";
import {
  type GitHubJob,
  type GitHubWebhookPayload,
  isGitHubPRCommentEvent,
  extractDexterInstruction,
  postGitHubComment,
} from "@dexter/shared";
import { queue, GITHUB_TOKEN } from "../config.js";
import { githubWebhookAuth } from "../middleware/index.js";

const router: Router = Router();

/**
 * GitHub webhook endpoint for PR comments
 */
router.post("/", githubWebhookAuth, async (req, res) => {
  try {
    const event = req.headers["x-github-event"];

    // Handle ping events (sent when webhook is first configured)
    if (event === "ping") {
      return res.status(200).json({ status: "pong" });
    }

    // Only process issue_comment events
    if (event !== "issue_comment") {
      return res
        .status(200)
        .json({ status: "ignored", reason: `event type: ${event}` });
    }

    const payload = req.body as GitHubWebhookPayload;

    // Only process new comments on PRs (not issues, not edits/deletes)
    if (!isGitHubPRCommentEvent(payload)) {
      return res
        .status(200)
        .json({ status: "ignored", reason: "not a new PR comment" });
    }

    const instruction = extractDexterInstruction(payload.comment.body);
    if (!instruction) {
      return res
        .status(200)
        .json({ status: "ignored", reason: "no @dexter trigger found" });
    }

    const { login: owner } = payload.repository.owner;
    const repo = payload.repository.name;
    const prNumber = payload.issue.number;

    const job: GitHubJob = {
      instruction,
      triggeredBy: payload.comment.user.login,
      source: "github",
      owner,
      repo,
      prNumber,
    };

    await queue.add("process-ticket", job, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });

    console.log(
      `Github Job queued: ${owner}/${repo}#${prNumber} - ${instruction}`,
    );

    await postGitHubComment(
      GITHUB_TOKEN,
      owner,
      repo,
      prNumber,
      "🤓 Okie dokie!",
    );

    return res.status(200).json({ status: "queued", prNumber });
  } catch (error) {
    console.error("GitHub webhook error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

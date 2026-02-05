import { Router } from "express";
import {
  type GitHubJob,
  type GitHubWebhookPayload,
  isGitHubPRCommentEvent,
  isGitHubIssueCommentEvent,
  extractBotInstruction,
  postGitHubComment,
  getBotName,
} from "@mapthew/shared";
import { queue, GITHUB_TOKEN, VERBOSE_LOGS } from "../config.js";
import { githubWebhookAuth } from "../middleware/index.js";

const router: Router = Router();

/**
 * GitHub webhook endpoint for PR and issue comments
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

    const job: GitHubJob = {
      instruction,
      triggeredBy: payload.comment.user.login,
      source: "github",
      owner,
      repo,
      prNumber: isPR ? number : undefined,
      issueNumber: isIssue ? number : undefined,
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

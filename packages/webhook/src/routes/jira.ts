import { Router } from "express";
import type { JiraJob, WebhookPayload } from "@mapthew/shared/types";
import { isCommentCreatedEvent, extractBotInstruction, getBotName } from "@mapthew/shared/utils";
import { postJiraComment } from "@mapthew/shared/api";
import { queue, jiraCredentials, VERBOSE_LOGS } from "../config.js";
import { jiraWebhookAuth } from "../middleware/index.js";

const router: Router = Router();

/**
 * Extract project key from issue key (e.g., "DXTR-123" -> "DXTR")
 */
function extractProjectKey(issueKey: string): string {
  const match = issueKey.match(/^([A-Z]+)-\d+$/i);
  return match ? match[1].toUpperCase() : issueKey.split("-")[0].toUpperCase();
}

/**
 * JIRA webhook endpoint
 */
router.post("/", jiraWebhookAuth, async (req, res) => {
  try {
    const payload = req.body as WebhookPayload;

    if (!isCommentCreatedEvent(payload)) {
      if (VERBOSE_LOGS)
        console.log(
          `Jira webhook ignored: not a comment_created event (webhookEvent: ${payload.webhookEvent ?? "unknown"})`,
        );
      return res
        .status(200)
        .json({ status: "ignored", reason: "not a comment_created event" });
    }

    const instruction = extractBotInstruction(payload.comment.body);
    if (!instruction) {
      if (VERBOSE_LOGS)
        console.log(
          `Jira webhook ignored: no @${getBotName()} trigger in ${payload.issue.key} comment by ${payload.comment.author.displayName}`,
        );
      return res.status(200).json({
        status: "ignored",
        reason: `no @${getBotName()} trigger found`,
      });
    }

    const job: JiraJob = {
      issueKey: payload.issue.key,
      instruction,
      triggeredBy: payload.comment.author.displayName,
      source: "jira",
      projectKey: extractProjectKey(payload.issue.key),
    };

    await queue.add("process-ticket", job, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });

    console.log(`Job queued for ${job.issueKey}: ${job.instruction}`);

    await postJiraComment(jiraCredentials, job.issueKey, "🤓 Okie dokie!");

    return res.status(200).json({ status: "queued", issueKey: job.issueKey });
  } catch (error) {
    console.error("JIRA webhook error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

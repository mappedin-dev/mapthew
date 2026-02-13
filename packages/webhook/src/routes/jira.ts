import { Router } from "express";
import type { JiraJob, WebhookPayload, JiraIssueUpdatedPayload } from "@mapthew/shared/types";
import {
  isCommentCreatedEvent,
  extractBotInstruction,
  getBotName,
  isIssueUpdatedEvent,
  wasLabelAdded,
  getLabelTrigger,
} from "@mapthew/shared/utils";
import { postJiraComment } from "@mapthew/shared/api";
import { getConfig } from "@mapthew/shared/config";
import type { JiraCredentials } from "@mapthew/shared/types";
import { queue, secretsManager } from "../config.js";
import { jiraWebhookAuth } from "../middleware/index.js";

const router: Router = Router();

/**
 * Build JIRA credentials from vault secrets + config
 */
async function getJiraCredentials(): Promise<JiraCredentials> {
  const secrets = await secretsManager.getMany(["jiraBaseUrl", "jiraEmail", "jiraApiToken"]);
  return {
    baseUrl: secrets.jiraBaseUrl || "",
    email: secrets.jiraEmail || "",
    apiToken: secrets.jiraApiToken || "",
  };
}

/**
 * Extract project key from issue key (e.g., "DXTR-123" -> "DXTR")
 */
function extractProjectKey(issueKey: string): string {
  const match = issueKey.match(/^([A-Z]+)-\d+$/i);
  return match ? match[1].toUpperCase() : issueKey.split("-")[0].toUpperCase();
}

/**
 * JIRA webhook endpoint
 *
 * Handles two event types:
 * 1. comment_created — When someone comments @botName on a ticket
 * 2. jira:issue_updated — When the configured trigger label is added to a ticket
 */
router.post("/", jiraWebhookAuth, async (req, res) => {
  try {
    const payload = req.body;
    const config = await getConfig();

    // --- Handle comment_created events (existing behaviour) ---
    if (isCommentCreatedEvent(payload as WebhookPayload)) {
      const commentPayload = payload as WebhookPayload;
      const instruction = extractBotInstruction(commentPayload.comment.body);
      if (!instruction) {
        return res.status(200).json({
          status: "ignored",
          reason: `no @${getBotName()} trigger found`,
        });
      }

      const job: JiraJob = {
        issueKey: commentPayload.issue.key,
        instruction,
        triggeredBy: commentPayload.comment.author.displayName,
        source: "jira",
        projectKey: extractProjectKey(commentPayload.issue.key),
      };

      await queue.add("process-ticket", job, {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      });

      console.log(`Job queued for ${job.issueKey}: ${job.instruction}`);

      const jiraCredentials = await getJiraCredentials();
      await postJiraComment(jiraCredentials, job.issueKey, "🤓 Okie dokie!");

      return res.status(200).json({ status: "queued", issueKey: job.issueKey });
    }

    // --- Handle jira:issue_updated events (label trigger) ---
    const labelTrigger = getLabelTrigger(config);
    if (isIssueUpdatedEvent(payload as JiraIssueUpdatedPayload)) {
      const updatedPayload = payload as JiraIssueUpdatedPayload;

      if (!labelTrigger) {
        return res.status(200).json({
          status: "ignored",
          reason: "label trigger not configured",
        });
      }

      if (!wasLabelAdded(updatedPayload, labelTrigger)) {
        return res.status(200).json({
          status: "ignored",
          reason: `trigger label "${labelTrigger}" was not added`,
        });
      }

      const job: JiraJob = {
        issueKey: updatedPayload.issue.key,
        instruction: "implement the change described in this ticket",
        triggeredBy: updatedPayload.user?.displayName ?? "label-trigger",
        source: "jira",
        projectKey: extractProjectKey(updatedPayload.issue.key),
      };

      await queue.add("process-ticket", job, {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      });

      console.log(
        `Job queued for ${job.issueKey} via label trigger "${labelTrigger}"`,
      );

      const jiraCredentials = await getJiraCredentials();
      await postJiraComment(jiraCredentials, job.issueKey, "🤓 Okie dokie!");

      return res.status(200).json({ status: "queued", issueKey: job.issueKey });
    }

    // --- Unhandled event ---
    return res
      .status(200)
      .json({ status: "ignored", reason: "unhandled event" });
  } catch (error) {
    console.error("JIRA webhook error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

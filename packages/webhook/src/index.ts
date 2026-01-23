import express from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import {
  createQueue,
  type Job,
  type WebhookPayload,
  isCommentCreatedEvent,
  extractDexterInstruction,
} from "@dexter/shared";

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "";
const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";

// Initialize queue
const queue = createQueue(REDIS_URL);

// Setup Bull Board dashboard
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin");

createBullBoard({
  queues: [new BullMQAdapter(queue)],
  serverAdapter,
});

app.use("/admin", serverAdapter.getRouter());

// Parse JSON bodies
app.use(express.json());

/**
 * Post a comment to JIRA
 */
async function postJiraComment(
  issueKey: string,
  comment: string
): Promise<void> {
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.warn("JIRA credentials not configured - skipping comment");
    return;
  }

  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString(
    "base64"
  );

  const response = await fetch(
    `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/comment`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        body: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: comment }],
            },
          ],
        },
      }),
    }
  );

  if (!response.ok) {
    console.error("Failed to post JIRA comment:", await response.text());
  }
}

/**
 * JIRA webhook endpoint
 */
app.post("/webhook/jira", async (req, res) => {
  try {
    const payload = req.body as WebhookPayload;

    // Only process comment_created events
    if (!isCommentCreatedEvent(payload)) {
      return res
        .status(200)
        .json({ status: "ignored", reason: "not a comment_created event" });
    }

    // Extract @dexter instruction
    const instruction = extractDexterInstruction(payload.comment.body);
    if (!instruction) {
      return res
        .status(200)
        .json({ status: "ignored", reason: "no @dexter trigger found" });
    }

    // Create job
    const job: Job = {
      issueKey: payload.issue.key,
      instruction,
      triggeredBy: payload.comment.author.displayName,
    };

    // Add to queue
    await queue.add("process-ticket", job, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    });

    console.log(`Job queued for ${job.issueKey}: ${job.instruction}`);

    // Post acknowledgment to JIRA
    await postJiraComment(job.issueKey, "🤓 Okie dokie!");

    return res.status(200).json({ status: "queued", issueKey: job.issueKey });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});

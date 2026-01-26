import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { createQueue } from "@dexter/shared/queue";
import {
  type Job,
  type WebhookPayload,
  isCommentCreatedEvent,
  extractDexterInstruction,
} from "@dexter/shared/types";

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "";
const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";
const JIRA_WEBHOOK_SECRET = process.env.JIRA_WEBHOOK_SECRET || "";

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

/**
 * Verify Jira webhook signature using HMAC-SHA256
 * Jira sends signature in X-Hub-Signature header with format: sha256=<signature>
 */
function verifyJiraSignature(
  secret: string,
  payload: string,
  signature: string
): boolean {
  if (!signature) return false;

  // Handle both "sha256=xxx" format and raw signature
  const sig = signature.startsWith("sha256=") ? signature.slice(7) : signature;

  const expectedSignature = createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(sig, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Middleware to verify Jira webhook secret
 */
function jiraWebhookAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip verification if no secret configured (local development)
  if (!JIRA_WEBHOOK_SECRET) {
    console.warn(
      "JIRA_WEBHOOK_SECRET not configured - skipping signature verification"
    );
    next();
    return;
  }

  const signature =
    (req.headers["x-hub-signature-256"] as string) ||
    (req.headers["x-hub-signature"] as string);

  if (!signature) {
    res.status(401).json({ error: "Missing webhook signature" });
    return;
  }

  const rawBody = (req as Request & { rawBody?: string }).rawBody;
  if (!rawBody) {
    res
      .status(500)
      .json({ error: "Raw body not available for signature verification" });
    return;
  }

  if (!verifyJiraSignature(JIRA_WEBHOOK_SECRET, rawBody, signature)) {
    console.warn("Invalid Jira webhook signature");
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  next();
}

// Parse JSON bodies and capture raw body for signature verification
app.use(
  express.json({
    verify: (req: Request, _res: Response, buf: Buffer) => {
      (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
    },
  })
);

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
app.post("/webhook/jira", jiraWebhookAuth, async (req, res) => {
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

import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import {
  createQueue,
  type Job,
  type WebhookPayload,
  type GitHubWebhookPayload,
  type GitHubContext,
  isCommentCreatedEvent,
  extractDexterInstruction,
  isGitHubPRCommentEvent,
  extractIssueKeyFromBranch,
} from "@dexter/shared";

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "";
const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";
const JIRA_WEBHOOK_SECRET = process.env.JIRA_WEBHOOK_SECRET || "";
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

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
 * Verify GitHub webhook signature using HMAC-SHA256
 */
function verifyGitHubSignature(
  secret: string,
  payload: string,
  signature: string
): boolean {
  if (!signature) return false;

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
 * Middleware to verify GitHub webhook secret
 */
function githubWebhookAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip verification if no secret configured (local development)
  if (!GITHUB_WEBHOOK_SECRET) {
    console.warn(
      "GITHUB_WEBHOOK_SECRET not configured - skipping signature verification"
    );
    next();
    return;
  }

  const signature = req.headers["x-hub-signature-256"] as string;

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

  if (!verifyGitHubSignature(GITHUB_WEBHOOK_SECRET, rawBody, signature)) {
    console.warn("Invalid GitHub webhook signature");
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  next();
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
      source: "jira",
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

/**
 * Post a comment to GitHub PR
 */
async function postGitHubComment(
  owner: string,
  repo: string,
  prNumber: number,
  comment: string
): Promise<void> {
  if (!GITHUB_TOKEN) {
    console.warn("GITHUB_TOKEN not configured - skipping comment");
    return;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ body: comment }),
    }
  );

  if (!response.ok) {
    console.error("Failed to post GitHub comment:", await response.text());
  }
}

/**
 * Get PR details including branch name
 */
async function getPRDetails(
  owner: string,
  repo: string,
  prNumber: number
): Promise<{ branch: string } | null> {
  if (!GITHUB_TOKEN) {
    console.warn("GITHUB_TOKEN not configured - cannot fetch PR details");
    return null;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!response.ok) {
    console.error("Failed to fetch PR details:", await response.text());
    return null;
  }

  const pr = (await response.json()) as { head: { ref: string } };
  return { branch: pr.head.ref };
}

/**
 * GitHub webhook endpoint for PR comments
 */
app.post("/webhook/github", githubWebhookAuth, async (req, res) => {
  try {
    const payload = req.body as GitHubWebhookPayload;

    // Only process comment_created events on PRs
    if (!isGitHubPRCommentEvent(payload)) {
      return res
        .status(200)
        .json({ status: "ignored", reason: "not a PR comment_created event" });
    }

    // Extract @dexter instruction
    const instruction = extractDexterInstruction(payload.comment.body);
    if (!instruction) {
      return res
        .status(200)
        .json({ status: "ignored", reason: "no @dexter trigger found" });
    }

    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const prNumber = payload.issue.number;

    // Get PR branch to extract issue key
    const prDetails = await getPRDetails(owner, repo, prNumber);
    if (!prDetails) {
      return res.status(500).json({ error: "Failed to fetch PR details" });
    }

    // Extract issue key from branch name (e.g., dexter_DXTR-123 -> DXTR-123)
    const issueKey = extractIssueKeyFromBranch(prDetails.branch);
    if (!issueKey) {
      await postGitHubComment(
        owner,
        repo,
        prNumber,
        "🤓 I couldn't find a JIRA issue key in the branch name. Branch names should contain a pattern like DXTR-123."
      );
      return res
        .status(200)
        .json({ status: "ignored", reason: "no issue key found in branch" });
    }

    // Create GitHub context
    const githubContext: GitHubContext = {
      owner,
      repo,
      prNumber,
      commentId: payload.comment.id,
      branch: prDetails.branch,
    };

    // Create job
    const job: Job = {
      issueKey,
      instruction,
      triggeredBy: payload.comment.user.login,
      source: "github",
      github: githubContext,
    };

    // Add to queue
    await queue.add("process-ticket", job, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    });

    console.log(
      `GitHub job queued for ${job.issueKey} (PR #${prNumber}): ${job.instruction}`
    );

    // Post acknowledgment to GitHub PR
    await postGitHubComment(owner, repo, prNumber, "🤓 Okie dokie!");

    return res
      .status(200)
      .json({ status: "queued", issueKey: job.issueKey, prNumber });
  } catch (error) {
    console.error("GitHub webhook error:", error);
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

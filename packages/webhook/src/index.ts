import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import {
  createQueue,
  type JiraJob,
  type GitHubJob,
  type WebhookPayload,
  type GitHubWebhookPayload,
  isCommentCreatedEvent,
  extractDexterInstruction,
  isGitHubPRCommentEvent,
  extractIssueKeyFromBranch,
  verifyHmacSignature,
  postJiraComment,
  postGitHubComment,
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

  if (!verifyHmacSignature(GITHUB_WEBHOOK_SECRET, rawBody, signature)) {
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

  if (!verifyHmacSignature(JIRA_WEBHOOK_SECRET, rawBody, signature)) {
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

// JIRA credentials for posting comments
const jiraCredentials = {
  baseUrl: JIRA_BASE_URL,
  email: JIRA_EMAIL,
  apiToken: JIRA_API_TOKEN,
};

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
    const job: JiraJob = {
      issueKey: payload.issue.key,
      instruction,
      triggeredBy: payload.comment.author.displayName,
      source: "jira",
      projectKey: extractProjectKey(payload.issue.key),
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
    await postJiraComment(jiraCredentials, job.issueKey, "🤓 Okie dokie!");

    return res.status(200).json({ status: "queued", issueKey: job.issueKey });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

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
    // Handle ping events (sent when webhook is first configured)
    if (req.headers["x-github-event"] === "ping") {
      return res.status(200).json({ status: "pong" });
    }

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
        GITHUB_TOKEN,
        owner,
        repo,
        prNumber,
        "🤓 I couldn't find a JIRA issue key in the branch name. Branch names should contain a pattern like DXTR-123."
      );
      return res
        .status(200)
        .json({ status: "ignored", reason: "no issue key found in branch" });
    }

    // Create job
    const job: GitHubJob = {
      issueKey,
      instruction,
      triggeredBy: payload.comment.user.login,
      source: "github",
      owner,
      repo,
      prNumber,
      commentId: payload.comment.id,
      branch: prDetails.branch,
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
    await postGitHubComment(
      GITHUB_TOKEN,
      owner,
      repo,
      prNumber,
      "🤓 Okie dokie!"
    );

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

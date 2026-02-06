import { createQueue, Queue } from "@mapthew/shared/queue";
import type { Job } from "@mapthew/shared/types";

export const PORT = process.env.PORT || 3000;
export const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
export const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "";
export const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
export const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";
export const JIRA_WEBHOOK_SECRET = process.env.JIRA_WEBHOOK_SECRET;
export const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
export const FIGMA_API_KEY = process.env.FIGMA_API_KEY || "";
export const VERBOSE_LOGS = process.env.VERBOSE_LOGS === "true";

// Auth0 - required
export const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
export const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

// Validate required configuration
const missing: string[] = [];
if (!AUTH0_DOMAIN) missing.push("AUTH0_DOMAIN");
if (!AUTH0_AUDIENCE) missing.push("AUTH0_AUDIENCE");
if (!JIRA_WEBHOOK_SECRET) missing.push("JIRA_WEBHOOK_SECRET");
if (!GITHUB_WEBHOOK_SECRET) missing.push("GITHUB_WEBHOOK_SECRET");

if (missing.length > 0) {
  console.error("Missing required configuration:");
  missing.forEach((name) => console.error(`  - ${name} is not set`));
  process.exit(1);
}

export const jiraCredentials = {
  baseUrl: JIRA_BASE_URL,
  email: JIRA_EMAIL,
  apiToken: JIRA_API_TOKEN,
};

export const queue: Queue<Job> = createQueue(REDIS_URL);

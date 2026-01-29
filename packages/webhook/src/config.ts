import { createQueue, Queue, type Job } from "@mapthew/shared";

export const PORT = process.env.PORT || 3000;
export const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
export const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "";
export const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
export const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";
export const JIRA_WEBHOOK_SECRET = process.env.JIRA_WEBHOOK_SECRET || "";
export const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

export const jiraCredentials = {
  baseUrl: JIRA_BASE_URL,
  email: JIRA_EMAIL,
  apiToken: JIRA_API_TOKEN,
};

export const queue: Queue<Job> = createQueue(REDIS_URL);

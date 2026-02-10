import { vi } from "vitest";

export const PORT = 3000;
export const REDIS_URL = "redis://localhost:6379";
export const JIRA_BASE_URL = "https://test.atlassian.net";
export const JIRA_EMAIL = "test@example.com";
export const JIRA_API_TOKEN = "mock-jira-token";
export const JIRA_WEBHOOK_SECRET = "mock-jira-webhook-secret";
export const GITHUB_WEBHOOK_SECRET = "mock-github-webhook-secret";
export const GITHUB_TOKEN = "mock-github-token";
export const AUTH0_DOMAIN = "test.auth0.com";
export const AUTH0_AUDIENCE = "https://test-api";

export const jiraCredentials = {
  baseUrl: JIRA_BASE_URL,
  email: JIRA_EMAIL,
  apiToken: JIRA_API_TOKEN,
};

// Mock BullMQ queue
export const queue = {
  name: "mapthew-jobs",
  add: vi.fn().mockResolvedValue({ id: "mock-job-id" }),
  getJob: vi.fn(),
  getJobs: vi.fn().mockResolvedValue([]),
  getJobCounts: vi.fn().mockResolvedValue({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  }),
};

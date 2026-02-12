import { vi } from "vitest";

export const PORT = 3000;
export const REDIS_URL = "redis://localhost:6379";
export const AUTH0_DOMAIN = "test.auth0.com";
export const AUTH0_AUDIENCE = "https://test-api";

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

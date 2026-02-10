import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Use vi.hoisted to define mock before vi.mock hoisting
const mockQueue = vi.hoisted(() => ({
  add: vi.fn().mockResolvedValue({ id: "job-123" }),
}));

// Mock config module
vi.mock("../config.js", () => ({
  queue: mockQueue,
  jiraCredentials: {
    baseUrl: "https://test.atlassian.net",
    email: "test@example.com",
    apiToken: "mock-token",
  },
  VERBOSE_LOGS: false,
}));

// Mock middleware to skip signature verification in tests
vi.mock("../middleware/index.js", () => ({
  jiraWebhookAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Mock @mapthew/shared subpaths
vi.mock("@mapthew/shared/api", async () => {
  const actual = await vi.importActual("@mapthew/shared/api");
  return {
    ...actual,
    postJiraComment: vi.fn().mockResolvedValue({ success: true }),
  };
});

vi.mock("@mapthew/shared/utils", async () => {
  const actual = await vi.importActual("@mapthew/shared/utils");
  return {
    ...actual,
    getBotName: vi.fn().mockReturnValue("mapthew"),
  };
});

import jiraRouter from "./jira.js";
import { postJiraComment } from "@mapthew/shared/api";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/webhook/jira", jiraRouter);
  return app;
}

describe("JIRA webhook routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /webhook/jira", () => {
    it("queues job for comment_created with @mapthew trigger", async () => {
      const payload = {
        webhookEvent: "comment_created",
        comment: {
          body: "@mapthew implement authentication",
          author: { displayName: "John Doe" },
        },
        issue: { key: "PROJ-123" },
      };

      const app = createApp();
      const res = await request(app)
        .post("/webhook/jira")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: "queued",
        issueKey: "PROJ-123",
      });
      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-ticket",
        expect.objectContaining({
          source: "jira",
          issueKey: "PROJ-123",
          projectKey: "PROJ",
          instruction: "implement authentication",
          triggeredBy: "John Doe",
        }),
        expect.any(Object)
      );
      expect(postJiraComment).toHaveBeenCalled();
    });

    it("ignores non-comment_created events", async () => {
      const payload = {
        webhookEvent: "comment_updated",
        comment: {
          body: "@mapthew do something",
          author: { displayName: "User" },
        },
        issue: { key: "TEST-1" },
      };

      const app = createApp();
      const res = await request(app)
        .post("/webhook/jira")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: "ignored",
        reason: "not a comment_created event",
      });
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("ignores comments without @mapthew trigger", async () => {
      const payload = {
        webhookEvent: "comment_created",
        comment: {
          body: "Just a regular comment",
          author: { displayName: "User" },
        },
        issue: { key: "TEST-1" },
      };

      const app = createApp();
      const res = await request(app)
        .post("/webhook/jira")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ignored");
      expect(res.body.reason).toContain("no @mapthew trigger found");
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("extracts project key from issue key", async () => {
      const payload = {
        webhookEvent: "comment_created",
        comment: {
          body: "@mapthew test",
          author: { displayName: "User" },
        },
        issue: { key: "MYPROJECT-456" },
      };

      const app = createApp();
      await request(app)
        .post("/webhook/jira")
        .send(payload);

      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-ticket",
        expect.objectContaining({
          projectKey: "MYPROJECT",
        }),
        expect.any(Object)
      );
    });
  });
});

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
  GITHUB_TOKEN: "mock-github-token",
}));

// Mock middleware to skip signature verification in tests
vi.mock("../middleware/index.js", () => ({
  githubWebhookAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Mock @mapthew/shared subpaths
vi.mock("@mapthew/shared/api", async () => {
  const actual = await vi.importActual("@mapthew/shared/api");
  return {
    ...actual,
    postGitHubComment: vi.fn().mockResolvedValue({ success: true }),
  };
});

vi.mock("@mapthew/shared/utils", async () => {
  const actual = await vi.importActual("@mapthew/shared/utils");
  return {
    ...actual,
    getBotName: vi.fn().mockReturnValue("mapthew"),
  };
});

import githubRouter from "./github.js";
import { postGitHubComment } from "@mapthew/shared/api";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/webhook/github", githubRouter);
  return app;
}

describe("GitHub webhook routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /webhook/github", () => {
    it("responds to ping event", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/webhook/github")
        .set("x-github-event", "ping")
        .send({});

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "pong" });
    });

    it("ignores non-issue_comment events", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/webhook/github")
        .set("x-github-event", "push")
        .send({});

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: "ignored",
        reason: "event type: push",
      });
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("queues job for PR comment with @mapthew trigger", async () => {
      const payload = {
        action: "created",
        comment: {
          id: 1,
          body: "@mapthew add unit tests",
          user: { login: "developer" },
        },
        issue: {
          number: 42,
          pull_request: { url: "https://api.github.com/repos/org/repo/pulls/42" },
        },
        repository: {
          name: "myrepo",
          owner: { login: "myorg" },
        },
        sender: { login: "developer" },
      };

      const app = createApp();
      const res = await request(app)
        .post("/webhook/github")
        .set("x-github-event", "issue_comment")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: "queued",
        number: 42,
        type: "PR",
      });
      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-ticket",
        expect.objectContaining({
          source: "github",
          owner: "myorg",
          repo: "myrepo",
          prNumber: 42,
          instruction: "add unit tests",
          triggeredBy: "developer",
        }),
        expect.any(Object)
      );
      expect(postGitHubComment).toHaveBeenCalled();
    });

    it("queues job for issue comment with @mapthew trigger", async () => {
      const payload = {
        action: "created",
        comment: {
          id: 2,
          body: "@mapthew implement this feature",
          user: { login: "user" },
        },
        issue: {
          number: 100,
          // No pull_request field - this is an issue
        },
        repository: {
          name: "project",
          owner: { login: "org" },
        },
        sender: { login: "user" },
      };

      const app = createApp();
      const res = await request(app)
        .post("/webhook/github")
        .set("x-github-event", "issue_comment")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: "queued",
        number: 100,
        type: "issue",
      });
      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-ticket",
        expect.objectContaining({
          source: "github",
          issueNumber: 100,
          prNumber: undefined,
        }),
        expect.any(Object)
      );
    });

    it("ignores edited comments", async () => {
      const payload = {
        action: "edited",
        comment: {
          id: 1,
          body: "@mapthew do something",
          user: { login: "user" },
        },
        issue: {
          number: 1,
          pull_request: { url: "https://api.github.com/repos/o/r/pulls/1" },
        },
        repository: {
          name: "repo",
          owner: { login: "org" },
        },
        sender: { login: "user" },
      };

      const app = createApp();
      const res = await request(app)
        .post("/webhook/github")
        .set("x-github-event", "issue_comment")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ignored");
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("queues job for PR review comment with @mapthew trigger", async () => {
      const payload = {
        action: "created",
        comment: {
          id: 10,
          body: "@mapthew cleanup this, i dont need the changes in this file",
          path: "requests.http",
          user: { login: "reviewer" },
        },
        pull_request: {
          number: 55,
          head: { ref: "feature/DXTR-10-context-keeping" },
        },
        repository: {
          name: "dexter",
          owner: { login: "mappedin-dev" },
        },
        sender: { login: "reviewer" },
      };

      const app = createApp();
      const res = await request(app)
        .post("/webhook/github")
        .set("x-github-event", "pull_request_review_comment")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: "queued",
        number: 55,
        type: "review-comment",
      });
      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-ticket",
        expect.objectContaining({
          source: "github",
          owner: "mappedin-dev",
          repo: "dexter",
          prNumber: 55,
          instruction: expect.stringContaining("requests.http"),
          triggeredBy: "reviewer",
          branchName: "feature/DXTR-10-context-keeping",
        }),
        expect.any(Object),
      );
      expect(postGitHubComment).toHaveBeenCalled();
    });

    it("ignores edited review comments", async () => {
      const payload = {
        action: "edited",
        comment: {
          id: 10,
          body: "@mapthew do something",
          path: "file.ts",
          user: { login: "reviewer" },
        },
        pull_request: {
          number: 55,
          head: { ref: "feature-branch" },
        },
        repository: {
          name: "repo",
          owner: { login: "org" },
        },
        sender: { login: "reviewer" },
      };

      const app = createApp();
      const res = await request(app)
        .post("/webhook/github")
        .set("x-github-event", "pull_request_review_comment")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ignored");
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("ignores review comments without @mapthew trigger", async () => {
      const payload = {
        action: "created",
        comment: {
          id: 10,
          body: "This looks good to me",
          path: "file.ts",
          user: { login: "reviewer" },
        },
        pull_request: {
          number: 55,
          head: { ref: "feature-branch" },
        },
        repository: {
          name: "repo",
          owner: { login: "org" },
        },
        sender: { login: "reviewer" },
      };

      const app = createApp();
      const res = await request(app)
        .post("/webhook/github")
        .set("x-github-event", "pull_request_review_comment")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ignored");
      expect(res.body.reason).toContain("no @mapthew trigger found");
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("ignores comments without @mapthew trigger", async () => {
      const payload = {
        action: "created",
        comment: {
          id: 1,
          body: "Just a regular comment",
          user: { login: "user" },
        },
        issue: {
          number: 1,
          pull_request: { url: "https://api.github.com/repos/o/r/pulls/1" },
        },
        repository: {
          name: "repo",
          owner: { login: "org" },
        },
        sender: { login: "user" },
      };

      const app = createApp();
      const res = await request(app)
        .post("/webhook/github")
        .set("x-github-event", "issue_comment")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ignored");
      expect(res.body.reason).toContain("no @mapthew trigger found");
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    // --- PR events (ignored — cleanup handled by periodic pruning) ---

    it("ignores pull_request events (sessions pruned by worker)", async () => {
      const payload = {
        action: "closed",
        pull_request: {
          number: 99,
          merged: true,
          head: { ref: "feature/DXTR-42-add-auth" },
        },
        repository: {
          name: "myrepo",
          owner: { login: "myorg" },
        },
      };

      const app = createApp();
      const res = await request(app)
        .post("/webhook/github")
        .set("x-github-event", "pull_request")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ignored");
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });
});

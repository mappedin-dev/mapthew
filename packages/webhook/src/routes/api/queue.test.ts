import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Use vi.hoisted to define mock before vi.mock hoisting
const mockQueue = vi.hoisted(() => ({
  name: "mapthew-jobs",
  add: vi.fn().mockResolvedValue({ id: "new-job-123" }),
  getJob: vi.fn(),
  getJobs: vi.fn().mockResolvedValue([]),
  getJobCounts: vi.fn().mockResolvedValue({
    waiting: 5,
    active: 2,
    completed: 100,
    failed: 3,
    delayed: 1,
  }),
}));

// Mock the config module
vi.mock("../../config.js", () => ({
  queue: mockQueue,
}));

import queueRouter from "./queue.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/queue", queueRouter);
  return app;
}

describe("Queue API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /queue", () => {
    it("returns queue statistics", async () => {
      const app = createApp();

      const res = await request(app).get("/queue");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        name: "mapthew-jobs",
        counts: {
          waiting: 5,
          active: 2,
          completed: 100,
          failed: 3,
          delayed: 1,
        },
      });
      expect(mockQueue.getJobCounts).toHaveBeenCalled();
    });
  });

  describe("GET /queue/jobs", () => {
    it("returns list of jobs", async () => {
      const mockJobs = [
        {
          id: "1",
          name: "process-ticket",
          data: { source: "jira", issueKey: "TEST-1" },
          getState: vi.fn().mockResolvedValue("completed"),
          progress: 100,
          attemptsMade: 1,
          timestamp: Date.now(),
          processedOn: Date.now(),
          finishedOn: Date.now(),
        },
      ];
      mockQueue.getJobs.mockResolvedValue(mockJobs);

      const app = createApp();
      const res = await request(app).get("/queue/jobs");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        id: "1",
        name: "process-ticket",
        status: "completed",
      });
    });

    it("filters by status", async () => {
      mockQueue.getJobs.mockResolvedValue([]);

      const app = createApp();
      await request(app).get("/queue/jobs?status=failed");

      expect(mockQueue.getJobs).toHaveBeenCalledWith(["failed"], 0, 49);
    });

    it("respects limit parameter", async () => {
      mockQueue.getJobs.mockResolvedValue([]);

      const app = createApp();
      await request(app).get("/queue/jobs?limit=10");

      expect(mockQueue.getJobs).toHaveBeenCalledWith(
        expect.any(Array),
        0,
        9
      );
    });

    it("caps limit at 100", async () => {
      mockQueue.getJobs.mockResolvedValue([]);

      const app = createApp();
      await request(app).get("/queue/jobs?limit=200");

      expect(mockQueue.getJobs).toHaveBeenCalledWith(
        expect.any(Array),
        0,
        99
      );
    });
  });

  describe("GET /queue/jobs/:id", () => {
    it("returns a single job", async () => {
      const mockJob = {
        id: "123",
        name: "process-ticket",
        data: { source: "github", owner: "org", repo: "repo" },
        getState: vi.fn().mockResolvedValue("active"),
        progress: 50,
        attemptsMade: 1,
        timestamp: Date.now(),
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const app = createApp();
      const res = await request(app).get("/queue/jobs/123");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: "123",
        name: "process-ticket",
        status: "active",
      });
    });

    it("returns 404 for non-existent job", async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).get("/queue/jobs/nonexistent");

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Job not found");
    });
  });

  describe("POST /queue/jobs", () => {
    it("creates a new admin job", async () => {
      const app = createApp();

      const res = await request(app)
        .post("/queue/jobs")
        .send({ instruction: "Run maintenance" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        jobId: "new-job-123",
      });
      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-ticket",
        expect.objectContaining({
          source: "admin",
          instruction: "Run maintenance",
          triggeredBy: "admin",
        }),
        expect.any(Object)
      );
    });

    it("creates admin job with JIRA context", async () => {
      const app = createApp();

      const res = await request(app)
        .post("/queue/jobs")
        .send({
          instruction: "Fix bug",
          jiraIssueKey: "PROJ-123",
          jiraBoardId: "board-1",
        });

      expect(res.status).toBe(200);
      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-ticket",
        expect.objectContaining({
          jiraIssueKey: "PROJ-123",
          jiraBoardId: "board-1",
        }),
        expect.any(Object)
      );
    });

    it("creates admin job with GitHub context", async () => {
      const app = createApp();

      const res = await request(app)
        .post("/queue/jobs")
        .send({
          instruction: "Add tests",
          githubOwner: "myorg",
          githubRepo: "myrepo",
          githubPrNumber: 42,
        });

      expect(res.status).toBe(200);
      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-ticket",
        expect.objectContaining({
          githubOwner: "myorg",
          githubRepo: "myrepo",
          githubPrNumber: 42,
        }),
        expect.any(Object)
      );
    });

    it("returns 400 when instruction is missing", async () => {
      const app = createApp();

      const res = await request(app)
        .post("/queue/jobs")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("instruction is required");
    });
  });

  describe("POST /queue/jobs/:id/retry", () => {
    it("retries a failed job", async () => {
      const mockJob = {
        id: "456",
        retry: vi.fn().mockResolvedValue(undefined),
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const app = createApp();
      const res = await request(app).post("/queue/jobs/456/retry");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
      expect(mockJob.retry).toHaveBeenCalled();
    });

    it("returns 404 for non-existent job", async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).post("/queue/jobs/nonexistent/retry");

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /queue/jobs/:id", () => {
    it("removes a job", async () => {
      const mockJob = {
        id: "789",
        remove: vi.fn().mockResolvedValue(undefined),
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const app = createApp();
      const res = await request(app).delete("/queue/jobs/789");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
      expect(mockJob.remove).toHaveBeenCalled();
    });

    it("returns 404 for non-existent job", async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).delete("/queue/jobs/nonexistent");

      expect(res.status).toBe(404);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";

// Use vi.hoisted to define mocks before vi.mock hoisting
const mockWorkspace = vi.hoisted(() => ({
  listSessions: vi.fn().mockResolvedValue([]),
  getMaxSessions: vi.fn().mockResolvedValue(5),
  getPruneThresholdDays: vi.fn().mockResolvedValue(7),
  cleanupWorkspace: vi.fn().mockResolvedValue(undefined),
}));

// Mock workspace module
vi.mock("@mapthew/shared/workspace", () => mockWorkspace);

import sessionsRouter from "./sessions.js";

/**
 * Creates an Express app that mirrors the production auth setup.
 *
 * In production (index.ts), sessions routes are mounted as:
 *   app.use("/api/sessions", jwtCheck, requireAdminPermission, sessionsRoutes);
 *
 * We simulate auth middleware behavior to verify the route is
 * properly protected when mounted with auth middleware.
 */
function createAppWithAuth(authenticated: boolean, hasPermission: boolean) {
  const app = express();
  app.use(express.json());

  // Simulate jwtCheck middleware
  const mockJwtCheck = (req: Request, res: Response, next: NextFunction) => {
    if (!authenticated) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  // Simulate requireAdminPermission middleware
  const mockAdminCheck = (req: Request, res: Response, next: NextFunction) => {
    if (!hasPermission) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };

  // Mount with auth — matching the production pattern in index.ts
  app.use("/api/sessions", mockJwtCheck, mockAdminCheck, sessionsRouter);
  return app;
}

/**
 * Creates an Express app WITHOUT auth middleware.
 * Used to test the router's own behavior in isolation.
 */
function createAppWithoutAuth() {
  const app = express();
  app.use(express.json());
  app.use("/api/sessions", sessionsRouter);
  return app;
}

describe("Sessions routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default values
    mockWorkspace.listSessions.mockResolvedValue([]);
    mockWorkspace.getMaxSessions.mockResolvedValue(5);
    mockWorkspace.getPruneThresholdDays.mockResolvedValue(7);
    mockWorkspace.cleanupWorkspace.mockResolvedValue(undefined);
  });

  describe("authentication", () => {
    it("rejects unauthenticated requests to GET /api/sessions", async () => {
      const app = createAppWithAuth(false, false);
      const res = await request(app).get("/api/sessions");

      expect(res.status).toBe(401);
      expect(mockWorkspace.listSessions).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated requests to GET /api/sessions/stats", async () => {
      const app = createAppWithAuth(false, false);
      const res = await request(app).get("/api/sessions/stats");

      expect(res.status).toBe(401);
      expect(mockWorkspace.listSessions).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated requests to DELETE /api/sessions/:issueKey", async () => {
      const app = createAppWithAuth(false, false);
      const res = await request(app).delete("/api/sessions/DXTR-123");

      expect(res.status).toBe(401);
      expect(mockWorkspace.cleanupWorkspace).not.toHaveBeenCalled();
    });

    it("rejects authenticated requests without admin permission", async () => {
      const app = createAppWithAuth(true, false);
      const res = await request(app).get("/api/sessions");

      expect(res.status).toBe(403);
      expect(mockWorkspace.listSessions).not.toHaveBeenCalled();
    });

    it("allows authenticated requests with admin permission", async () => {
      const app = createAppWithAuth(true, true);
      const res = await request(app).get("/api/sessions");

      expect(res.status).toBe(200);
      expect(mockWorkspace.listSessions).toHaveBeenCalled();
    });
  });

  describe("GET /api/sessions", () => {
    it("returns session list with counts", async () => {
      const mockDate = new Date("2024-06-01T12:00:00Z");
      mockWorkspace.listSessions.mockResolvedValue([
        {
          issueKey: "DXTR-123",
          workspacePath: "/tmp/test-workspaces/DXTR-123",
          createdAt: mockDate,
          lastUsed: mockDate,
          hasSession: true,
          sizeBytes: 1048576,
        },
      ]);
      mockWorkspace.getMaxSessions.mockResolvedValue(5);

      const app = createAppWithoutAuth();
      const res = await request(app).get("/api/sessions");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        count: 1,
        softCap: 5,
        available: 4,
        pruneThresholdDays: 7,
        sessions: [
          {
            issueKey: "DXTR-123",
            createdAt: mockDate.toISOString(),
            lastUsed: mockDate.toISOString(),
            hasSession: true,
            sizeBytes: 1048576,
            sizeMB: 1,
          },
        ],
      });
    });

    it("returns empty list when no sessions exist", async () => {
      const app = createAppWithoutAuth();
      const res = await request(app).get("/api/sessions");

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.sessions).toEqual([]);
    });

    it("returns 500 when listing fails", async () => {
      mockWorkspace.listSessions.mockRejectedValue(new Error("disk error"));

      const app = createAppWithoutAuth();
      const res = await request(app).get("/api/sessions");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Failed to list sessions" });
    });
  });

  describe("GET /api/sessions/stats", () => {
    it("returns session statistics", async () => {
      mockWorkspace.listSessions.mockResolvedValue([
        { hasSession: true, sizeBytes: 1000 },
        { hasSession: false, sizeBytes: 500 },
        { hasSession: true, sizeBytes: 2000 },
      ]);
      mockWorkspace.getMaxSessions.mockResolvedValue(5);

      const app = createAppWithoutAuth();
      const res = await request(app).get("/api/sessions/stats");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        total: 3,
        active: 2,
        softCap: 5,
        available: 3,
        pruneThresholdDays: 7,
        utilizationPercent: 40,
        totalSizeBytes: 3000,
        totalSizeMB: 0,
      });
    });

    it("returns 500 when stats fail", async () => {
      mockWorkspace.listSessions.mockRejectedValue(new Error("read error"));

      const app = createAppWithoutAuth();
      const res = await request(app).get("/api/sessions/stats");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Failed to get session stats" });
    });
  });

  describe("DELETE /api/sessions/:issueKey", () => {
    it("directly cleans up the workspace", async () => {
      const app = createAppWithoutAuth();
      const res = await request(app).delete("/api/sessions/DXTR-123");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Session cleaned up for DXTR-123",
      });
      expect(mockWorkspace.cleanupWorkspace).toHaveBeenCalledWith("DXTR-123");
    });

    it("handles composite GitHub issue keys", async () => {
      const app = createAppWithoutAuth();
      const res = await request(app).delete("/api/sessions/gh-org-repo-42");

      expect(res.status).toBe(200);
      expect(mockWorkspace.cleanupWorkspace).toHaveBeenCalledWith("gh-org-repo-42");
    });

    it("returns 500 when cleanup fails", async () => {
      mockWorkspace.cleanupWorkspace.mockRejectedValue(new Error("disk error"));

      const app = createAppWithoutAuth();
      const res = await request(app).delete("/api/sessions/DXTR-123");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Failed to clean up session" });
    });
  });
});

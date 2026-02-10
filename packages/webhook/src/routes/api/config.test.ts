import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock @mapthew/shared subpaths before importing the route
vi.mock("@mapthew/shared/config", async () => {
  const actual = await vi.importActual("@mapthew/shared/config");
  return {
    ...actual,
    getConfig: vi.fn().mockResolvedValue({
      botName: "testbot",
      claudeModel: "claude-sonnet-4-5",
      jiraBaseUrl: "https://test.atlassian.net",
    }),
    saveConfig: vi.fn().mockResolvedValue(undefined),
  };
});

import configRouter from "./config.js";
import { getConfig, saveConfig } from "@mapthew/shared/config";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/config", configRouter);
  return app;
}

describe("Config API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /config", () => {
    it("returns current configuration", async () => {
      const app = createApp();

      const res = await request(app).get("/config");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        botName: "testbot",
        claudeModel: "claude-sonnet-4-5",
        jiraBaseUrl: "https://test.atlassian.net",
      });
      expect(getConfig).toHaveBeenCalled();
    });
  });

  describe("PUT /config", () => {
    it("updates bot name", async () => {
      const app = createApp();

      const res = await request(app)
        .put("/config")
        .send({ botName: "newbot" });

      expect(res.status).toBe(200);
      expect(saveConfig).toHaveBeenCalled();
    });

    it("updates claude model", async () => {
      const app = createApp();

      const res = await request(app)
        .put("/config")
        .send({ claudeModel: "claude-haiku-4-5" });

      expect(res.status).toBe(200);
      expect(saveConfig).toHaveBeenCalled();
    });

    it("rejects invalid claude model", async () => {
      const app = createApp();

      const res = await request(app)
        .put("/config")
        .send({ claudeModel: "invalid-model" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid model");
    });

    it("updates JIRA base URL", async () => {
      const app = createApp();

      const res = await request(app)
        .put("/config")
        .send({ jiraBaseUrl: "https://newjira.atlassian.net" });

      expect(res.status).toBe(200);
      expect(saveConfig).toHaveBeenCalled();
    });

    it("rejects invalid JIRA URL", async () => {
      const app = createApp();

      const res = await request(app)
        .put("/config")
        .send({ jiraBaseUrl: "http://not-https.com" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid JIRA base URL");
    });

    it("allows empty JIRA URL", async () => {
      const app = createApp();

      const res = await request(app)
        .put("/config")
        .send({ jiraBaseUrl: "" });

      expect(res.status).toBe(200);
      expect(saveConfig).toHaveBeenCalled();
    });

    it("returns 500 when saveConfig throws", async () => {
      const { saveConfig: mockSaveConfig } = await import("@mapthew/shared/config");
      vi.mocked(mockSaveConfig).mockRejectedValueOnce(new Error("Redis connection failed"));

      const app = createApp();

      const res = await request(app)
        .put("/config")
        .send({ botName: "newbot" });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Redis connection failed");
    });
  });
});

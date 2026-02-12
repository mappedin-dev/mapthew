import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock ioredis with ioredis-mock before importing config
vi.mock("ioredis", async () => {
  const RedisMock = (await import("ioredis-mock")).default;
  return { Redis: RedisMock };
});

import {
  initConfigStore,
  getConfig,
  saveConfig,
  getClaudeModel,
} from "./config.js";
import { setBotName } from "./utils.js";

describe("config persistence with Redis", () => {
  beforeEach(async () => {
    // Initialize with mock Redis
    await initConfigStore("redis://localhost:6379");
    setBotName("mapthew");
  });

  it("saves and retrieves config", async () => {
    await saveConfig({
      botName: "persistbot",
      claudeModel: "claude-sonnet-4-5",
      maxSessions: 10,
      pruneThresholdDays: 14,
      pruneIntervalDays: 1,
    });

    const config = await getConfig();
    expect(config.botName).toBe("persistbot");
    expect(config.claudeModel).toBe("claude-sonnet-4-5");
    expect(config.maxSessions).toBe(10);
    expect(config.pruneThresholdDays).toBe(14);
    expect(config.pruneIntervalDays).toBe(1);
  });

  it("throws on invalid bot name during save", async () => {
    await expect(
      saveConfig({
        botName: "Invalid-Name",
        claudeModel: "claude-sonnet-4-5",
        maxSessions: 5,
        pruneThresholdDays: 7,
        pruneIntervalDays: 7,
      })
    ).rejects.toThrow();
  });

  it("returns default config when Redis has no data", async () => {
    // Create a fresh mock Redis connection
    await initConfigStore("redis://localhost:6380");
    const config = await getConfig();
    expect(config.botName).toBeDefined();
    expect(config.claudeModel).toBeDefined();
  });
});

describe("getClaudeModel", () => {
  beforeEach(async () => {
    await initConfigStore("redis://localhost:6379");
    setBotName("mapthew");
  });

  it("returns model from config", async () => {
    await saveConfig({
      botName: "mapthew",
      claudeModel: "claude-haiku-4-5",
      maxSessions: 5,
      pruneThresholdDays: 7,
      pruneIntervalDays: 7,
    });

    const model = await getClaudeModel();
    expect(model).toBe("claude-haiku-4-5");
  });

  it("returns default model when not configured", async () => {
    // Fresh Redis connection with no config
    await initConfigStore("redis://localhost:6381");
    const model = await getClaudeModel();
    expect(model).toBeDefined();
  });
});

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
      jiraBaseUrl: "https://test.atlassian.net",
    });

    const config = await getConfig();
    expect(config.botName).toBe("persistbot");
    expect(config.claudeModel).toBe("claude-sonnet-4-5");
    expect(config.jiraBaseUrl).toBe("https://test.atlassian.net");
  });

  it("throws on invalid bot name during save", async () => {
    await expect(
      saveConfig({
        botName: "Invalid-Name",
        claudeModel: "claude-sonnet-4-5",
        jiraBaseUrl: "",
      })
    ).rejects.toThrow();
  });

  it("throws on invalid JIRA URL during save", async () => {
    await expect(
      saveConfig({
        botName: "validbot",
        claudeModel: "claude-sonnet-4-5",
        jiraBaseUrl: "http://not-https.com",
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
      jiraBaseUrl: "",
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

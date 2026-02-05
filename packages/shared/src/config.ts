import type { Redis } from "ioredis";
import type { ClaudeModel, AppConfig } from "./types.js";
import { getBotName, isValidBotName, isValidJiraUrl, setBotName } from "./utils.js";

let redisClient: Redis | null = null;

const CONFIG_KEY = "mapthew:config";

const DEFAULT_CONFIG: AppConfig = {
  botName: process.env.BOT_NAME ?? "mapthew",
  claudeModel: (process.env.CLAUDE_MODEL as ClaudeModel) ?? "claude-sonnet-4-5",
  jiraBaseUrl: process.env.JIRA_BASE_URL ?? "",
};

/**
 * Initialize the Redis client for config storage
 */
export async function initConfigStore(redisUrl: string): Promise<void> {
  // Avoid importing ioredis synchronously
  // It has runtime behaviour we don't want to trigger in the client
  const { Redis } = await import("ioredis");
  redisClient = new Redis(redisUrl);
}

/**
 * Get the current config from Redis (or defaults)
 */
export async function getConfig(): Promise<AppConfig> {
  if (!redisClient) {
    return { ...DEFAULT_CONFIG, botName: getBotName() };
  }

  try {
    const data = await redisClient.get(CONFIG_KEY);
    if (data) {
      const config = JSON.parse(data) as AppConfig;
      // Update in-memory botName when loading from Redis
      if (config.botName && isValidBotName(config.botName)) {
        setBotName(config.botName);
      }
      // Ensure jiraBaseUrl has a fallback
      return {
        ...DEFAULT_CONFIG,
        ...config,
      };
    }
  } catch (error) {
    console.error("Error loading config from Redis:", error);
  }

  return { ...DEFAULT_CONFIG, botName: getBotName() };
}

/**
 * Save config to Redis
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  if (!isValidBotName(config.botName)) {
    throw new Error(
      `Invalid bot name "${config.botName}" - must be lowercase alphanumeric with dashes/underscores, starting with alphanumeric (max 32 chars)`
    );
  }

  if (!isValidJiraUrl(config.jiraBaseUrl)) {
    throw new Error(
      `Invalid JIRA base URL "${config.jiraBaseUrl}" - must be a valid HTTPS URL`
    );
  }

  // Update in-memory state
  setBotName(config.botName);

  if (!redisClient) {
    console.warn("Redis client not initialized, config not persisted");
    return;
  }

  await redisClient.set(CONFIG_KEY, JSON.stringify(config));
}

/**
 * Get the Claude model to use
 */
export async function getClaudeModel(): Promise<ClaudeModel> {
  const config = await getConfig();
  return config.claudeModel;
}

import type { Redis } from "ioredis";
import type { ClaudeModel, AppConfig } from "./types.js";
import {
  getBotName,
  isValidBotName,
  setBotName,
  setJiraBotAccountId,
} from "./utils.js";

let redisClient: Redis | null = null;

const CONFIG_KEY = "mapthew:config";

/**
 * Build default config from environment variables.
 * Called lazily so env vars set after module load are respected (e.g. in tests).
 */
function getDefaultConfig(): AppConfig {
  return {
    botName: process.env.BOT_NAME ?? "mapthew",
    claudeModel:
      (process.env.CLAUDE_MODEL as ClaudeModel) ?? "claude-sonnet-4-5",
    jiraLabelTrigger: process.env.JIRA_LABEL_TRIGGER ?? "claude-ready",
    jiraLabelAdd: process.env.JIRA_LABEL_ADD ?? "claude-processed",
    jiraBotAccountId: process.env.JIRA_BOT_ACCOUNT_ID ?? "",
    maxSessions: parseInt(process.env.MAX_SESSIONS || "20", 10),
    pruneThresholdDays: parseInt(process.env.PRUNE_THRESHOLD_DAYS || "7", 10),
    pruneIntervalDays: parseInt(process.env.PRUNE_INTERVAL_DAYS || "7", 10),
    maxOutputBufferBytes: 10 * 1024 * 1024,
  };
}

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
  const defaults = getDefaultConfig();

  if (!redisClient) {
    return { ...defaults, botName: getBotName() };
  }

  try {
    const data = await redisClient.get(CONFIG_KEY);
    if (data) {
      const config = JSON.parse(data) as AppConfig;
      // Update in-memory botName when loading from Redis
      if (config.botName && isValidBotName(config.botName)) {
        setBotName(config.botName);
      }
      // Update in-memory JIRA bot account ID when loading from Redis
      if (config.jiraBotAccountId) {
        setJiraBotAccountId(config.jiraBotAccountId);
      }
      // Merge with defaults so new fields get fallback values
      return {
        ...defaults,
        ...config,
      };
    }
  } catch (error) {
    console.error("Error loading config from Redis:", error);
  }

  return { ...defaults, botName: getBotName() };
}

/**
 * Save config to Redis
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  if (!isValidBotName(config.botName)) {
    throw new Error(
      `Invalid bot name "${config.botName}" - must be lowercase alphanumeric with dashes/underscores, starting with alphanumeric (max 32 chars)`,
    );
  }

  // Update in-memory state
  setBotName(config.botName);
  setJiraBotAccountId(config.jiraBotAccountId ?? "");

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

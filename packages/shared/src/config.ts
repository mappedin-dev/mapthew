import { Redis } from "ioredis";

// Internal state - can be updated at runtime
let botName: string | null = null;
let redisClient: Redis | null = null;

// Valid bot name pattern: lowercase alphanumeric, dashes, underscores (safe for git branches and queue names)
const VALID_BOT_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const CONFIG_KEY = "mapthew:config";

/**
 * Application configuration stored in Redis
 */
export interface AppConfig {
  botName: string;
}

const DEFAULT_CONFIG: AppConfig = {
  botName: process.env.BOT_NAME ?? "mapthew",
};

/**
 * Initialize the Redis client for config storage
 */
export function initConfigStore(redisUrl: string): void {
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
        botName = config.botName;
      }
      return config;
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

  // Update in-memory state
  botName = config.botName;

  if (!redisClient) {
    console.warn("Redis client not initialized, config not persisted");
    return;
  }

  await redisClient.set(CONFIG_KEY, JSON.stringify(config));
}

/**
 * Validate a bot name for use in branches and queue names
 * Must be lowercase alphanumeric with dashes/underscores, starting with alphanumeric
 */
export function isValidBotName(name: string): boolean {
  return VALID_BOT_NAME_PATTERN.test(name) && name.length <= 32;
}

/**
 * Get the bot name (used for triggers, branch prefixes, etc.)
 * Reads from: 1) runtime setter, 2) BOT_NAME env var, 3) default "mapthew"
 */
export function getBotName(): string {
  const name = botName ?? process.env.BOT_NAME ?? "mapthew";
  if (!isValidBotName(name)) {
    console.warn(
      `Invalid BOT_NAME "${name}" - must be lowercase alphanumeric with dashes/underscores (max 32 chars). Using "mapthew".`
    );
    return "mapthew";
  }
  return name;
}

/**
 * Get the bot name formatted for display (first letter capitalized)
 * e.g., "mapthew" -> "Mapthew", "code-bot" -> "Code-bot"
 */
export function getBotDisplayName(): string {
  const name = getBotName();
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Set the bot name at runtime (for future dashboard config)
 * @throws Error if the name is invalid
 */
export function setBotName(name: string): void {
  if (!isValidBotName(name)) {
    throw new Error(
      `Invalid bot name "${name}" - must be lowercase alphanumeric with dashes/underscores, starting with alphanumeric (max 32 chars)`
    );
  }
  botName = name;
}

/**
 * Get the regex pattern for detecting bot triggers in comments
 * e.g., /@mapthew\s+(.*)/i
 */
export function getTriggerPattern(): RegExp {
  return new RegExp(`@${getBotName()}\\s+(.*)`, "i");
}

/**
 * Get the BullMQ queue name
 */
export function getQueueName(): string {
  return `${getBotName()}-jobs`;
}

/**
 * Get the branch prefix for new branches
 */
export function getBranchPrefix(): string {
  return `${getBotName()}-bot`;
}

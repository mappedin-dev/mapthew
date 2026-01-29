// Internal state - can be updated at runtime
let botName: string | null = null;

// Valid bot name pattern: lowercase alphanumeric, dashes, underscores (safe for git branches and queue names)
const VALID_BOT_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

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

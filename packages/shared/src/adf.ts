import type { AdfNode } from "./types.js";
import { getBotName, getTriggerPattern } from "./utils.js";

/**
 * Extract plain text from an Atlassian Document Format (ADF) node tree.
 * Recursively walks the ADF structure and concatenates text from:
 * - "text" nodes (via their .text property)
 * - "mention" nodes (via their .attrs.text property, e.g., "@mapthew")
 */
export function extractTextFromAdf(node: AdfNode): string {
  if (node.type === "text" && node.text) {
    return node.text;
  }
  if (node.type === "mention" && node.attrs?.text) {
    return node.attrs.text as string;
  }
  if (node.content) {
    return node.content.map(extractTextFromAdf).join("");
  }
  return "";
}

/**
 * Collect all inline (leaf) nodes from an ADF tree in document order.
 * Returns a flat array of text and mention nodes.
 */
function collectInlineNodes(node: AdfNode): AdfNode[] {
  if (node.type === "text" || node.type === "mention") {
    return [node];
  }
  if (node.content) {
    return node.content.flatMap(collectInlineNodes);
  }
  return [];
}

/**
 * Check if an ADF mention node references the bot.
 * Matches flexibly: the mention's display text (attrs.text) must contain the
 * bot name as a whole word, case-insensitive.  This handles Jira display names
 * like "@mapthew", "@Mapthew", "@Mapthew Bot", etc.
 */
function isBotMentionAdf(node: AdfNode): boolean {
  if (node.type !== "mention" || !node.attrs?.text) return false;
  const mentionText = (node.attrs.text as string).toLowerCase();
  const name = getBotName().toLowerCase();
  // Check if the mention text contains the bot name as a word boundary match
  // e.g., "@mapthew" matches "mapthew", "@Mapthew Bot" matches "mapthew"
  const pattern = new RegExp(`\\b${name}\\b`);
  return pattern.test(mentionText);
}

/**
 * Extract bot instruction from an ADF document by finding a bot mention node
 * and collecting all text that follows it.
 *
 * This handles Jira rich mentions where the mention node's attrs.text may not
 * exactly match the configured bot name (e.g., display name "Mapthew Bot"
 * when bot name is "mapthew").
 */
export function extractInstructionFromAdf(root: AdfNode): string | null {
  const inlineNodes = collectInlineNodes(root);

  // First, try to find a rich mention node that references the bot
  const mentionIdx = inlineNodes.findIndex(isBotMentionAdf);
  if (mentionIdx !== -1) {
    // Collect all text after the mention node
    const afterMention = inlineNodes
      .slice(mentionIdx + 1)
      .map((n) => {
        if (n.type === "text" && n.text) return n.text;
        if (n.type === "mention" && n.attrs?.text) return n.attrs.text as string;
        return "";
      })
      .join("")
      .trim();
    return afterMention || null;
  }

  // Fall back to plain-text regex matching (handles plain text @mentions in ADF)
  const fullText = extractTextFromAdf(root);
  const match = fullText.match(getTriggerPattern());
  return match ? match[1].trim() : null;
}

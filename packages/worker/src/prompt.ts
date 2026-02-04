import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  type Job,
  isGitHubJob,
  isJiraJob,
  getBotName,
  getBranchPrefix,
} from "@mapthew/shared";

// ES module equivalent of __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// JIRA post-processing config (Claude handles via MCP)
const JIRA_LABEL_ADD = process.env.JIRA_LABEL_ADD || "";
const JIRA_LABEL_REMOVE = process.env.JIRA_LABEL_REMOVE || "";

/**
 * Build JIRA post-processing instructions based on config
 */
function buildJiraPostProcessing(): string {
  const steps: string[] = [];

  if (JIRA_LABEL_ADD) {
    steps.push(`- Add label: "${JIRA_LABEL_ADD}"`);
  }
  if (JIRA_LABEL_REMOVE) {
    steps.push(`- Remove label: "${JIRA_LABEL_REMOVE}" (if present)`);
  }
  // Always include transition instruction - Claude figures out the right status
  steps.push(`- Transition to an appropriate status (e.g., "Code Review", "In Review", "Ready for Review") based on available transitions`);

  return steps.join("\n");
}

// Load all instruction markdown files at startup
const instructionsDir = path.join(__dirname, "..", "instructions");

function loadInstructions(): string[] {
  const files = fs.readdirSync(instructionsDir);
  const mdFiles = files.filter((f) => f.endsWith(".md"));

  // Ensure general.md is always first, then sort the rest alphabetically
  const sorted = mdFiles.sort((a, b) => {
    if (a === "general.md") return -1;
    if (b === "general.md") return 1;
    return a.localeCompare(b);
  });

  return sorted.map((file) =>
    fs.readFileSync(path.join(instructionsDir, file), "utf-8")
  );
}

const instructionTemplates = loadInstructions();

/**
 * Build the prompt for Claude Code CLI
 *
 * All instruction files are loaded and concatenated. Job-specific
 * context is injected via template placeholders. Missing values
 * are replaced with "unknown".
 */
export function buildPrompt(job: Job): string {
  // Build job context for template replacement
  const context: Record<string, string> = {
    triggeredBy: job.triggeredBy,
    instruction: job.instruction,
    botName: getBotName(),
    branchPrefix: getBranchPrefix(),
    // GitHub context (defaults to "unknown")
    "github.owner": isGitHubJob(job) ? job.owner : "unknown",
    "github.repo": isGitHubJob(job) ? job.repo : "unknown",
    "github.prNumber":
      isGitHubJob(job) && job.prNumber ? String(job.prNumber) : "unknown",
    // Jira context (defaults to "unknown")
    "jira.issueKey": isJiraJob(job) ? job.issueKey : "unknown",
  };

  // Add JIRA post-processing config to context
  if (isJiraJob(job)) {
    context["jira.postProcessing"] = buildJiraPostProcessing();
  }

  // Process all instruction templates
  const prompt = instructionTemplates
    .map((template) => replaceVariables(template, context))
    .join("\n\n---\n\n");

  return prompt.trim();
}

/**
 * Replace variable placeholders with values from context
 */
function replaceVariables(
  template: string,
  context: Record<string, string>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const value = context[key.trim()];
    return value !== undefined ? value : "unknown";
  });
}

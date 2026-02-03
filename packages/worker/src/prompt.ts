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

  return `12. Update the JIRA ticket using the JIRA MCP:\n    ${steps.join("\n    ")}`;
}

// Load instructions templates at startup
const jiraInstructionsPath = path.join(
  __dirname,
  "..",
  "instructions",
  "jira.txt"
);
const jiraInstructionsTemplate = fs.readFileSync(jiraInstructionsPath, "utf-8");

const githubInstructionsPath = path.join(
  __dirname,
  "..",
  "instructions",
  "github.txt"
);
const githubInstructionsTemplate = fs.readFileSync(
  githubInstructionsPath,
  "utf-8"
);

/**
 * Build the prompt for Claude Code CLI
 */
export function buildPrompt(job: Job): string {
  if (isGitHubJob(job)) {
    return githubInstructionsTemplate
      .replace(/\{\{botName\}\}/g, getBotName())
      .replace(/\{\{branchPrefix\}\}/g, getBranchPrefix())
      .replace(/\{\{triggeredBy\}\}/g, job.triggeredBy)
      .replace(/\{\{instruction\}\}/g, job.instruction)
      .replace(/\{\{owner\}\}/g, job.owner)
      .replace(/\{\{repo\}\}/g, job.repo)
      .replace(/\{\{prNumber\}\}/g, String(job.prNumber))
      .replace(/\{\{timestamp\}\}/g, String(Date.now()))
      .trim();
  }

  if (isJiraJob(job)) {
    return jiraInstructionsTemplate
      .replace(/\{\{botName\}\}/g, getBotName())
      .replace(/\{\{branchPrefix\}\}/g, getBranchPrefix())
      .replace(/\{\{issueKey\}\}/g, job.issueKey)
      .replace(/\{\{triggeredBy\}\}/g, job.triggeredBy)
      .replace(/\{\{instruction\}\}/g, job.instruction)
      .replace(/\{\{postProcessing\}\}/g, buildJiraPostProcessing())
      .replace(/\{\{timestamp\}\}/g, String(Date.now()))
      .trim();
  }

  return "";
}

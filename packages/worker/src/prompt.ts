import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Job } from "@mapthew/shared/types";
import { isGitHubJob, isJiraJob, isAdminJob, getBotName, getBranchPrefix, getLabelTrigger, getLabelAdd } from "@mapthew/shared/utils";
import { getConfig } from "@mapthew/shared/config";

// ES module equivalent of __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Build JIRA post-processing instructions based on config
 */
export function buildJiraPostProcessing(
  labelAdd = "",
  labelTrigger = "",
): string {
  const steps: string[] = [];

  if (labelAdd) {
    steps.push(`- Add label: "${labelAdd}"`);
  }
  if (labelTrigger) {
    steps.push(`- Remove label: "${labelTrigger}" (if present)`);
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
 * Extract GitHub context from any job type
 */
function getGitHubContext(job: Job) {
  if (isGitHubJob(job)) {
    return {
      owner: job.owner,
      repo: job.repo,
      prNumber: job.prNumber ? String(job.prNumber) : undefined,
      issueNumber: job.issueNumber ? String(job.issueNumber) : undefined,
      branchId: job.branchName,
    };
  }
  if (isAdminJob(job)) {
    return {
      owner: job.githubOwner,
      repo: job.githubRepo,
      prNumber: job.githubPrNumber ? String(job.githubPrNumber) : undefined,
      issueNumber: job.githubIssueNumber ? String(job.githubIssueNumber) : undefined,
      branchId: job.githubBranchId,
    };
  }
  return {};
}

/**
 * Extract JIRA context from any job type
 */
function getJiraContext(job: Job) {
  if (isJiraJob(job)) {
    return {
      issueKey: job.issueKey,
      boardId: undefined,
    };
  }
  if (isAdminJob(job)) {
    return {
      issueKey: job.jiraIssueKey,
      boardId: job.jiraBoardId,
    };
  }
  return {};
}

/**
 * Build the prompt for Claude Code CLI
 *
 * All instruction files are loaded and concatenated. Job-specific
 * context is injected via template placeholders. Missing values
 * are replaced with "unknown".
 */
export async function buildPrompt(job: Job): Promise<string> {
  const github = getGitHubContext(job);
  const jira = getJiraContext(job);

  const context: Record<string, string> = {
    // Common
    triggeredBy: job.triggeredBy,
    instruction: job.instruction,
    botName: getBotName(),
    branchPrefix: getBranchPrefix(),
    // GitHub
    "github.owner": github.owner ?? "unknown",
    "github.repo": github.repo ?? "unknown",
    "github.prNumber": github.prNumber ?? "unknown",
    "github.branchId": github.branchId ?? "unknown",
    // JIRA
    "jira.issueKey": jira.issueKey ?? "unknown",
    "jira.boardId": jira.boardId ?? "unknown",
  };

  // Add JIRA post-processing config to context
  if (isJiraJob(job)) {
    const config = await getConfig();
    context["jira.postProcessing"] = buildJiraPostProcessing(
      getLabelAdd(config),
      getLabelTrigger(config),
    );
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

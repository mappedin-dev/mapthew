import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { type Job, isGitHubJob } from "@dexter/shared";

// ES module equivalent of __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// MCP config path
const mcpConfigPath = path.join(__dirname, "..", "mcp-config.json");

/**
 * Build the prompt for Claude Code CLI
 */
function buildPrompt(job: Job): string {
  // Use GitHub-specific template if job was triggered from GitHub
  if (isGitHubJob(job)) {
    return githubInstructionsTemplate
      .replace(/\{\{issueKey\}\}/g, job.issueKey)
      .replace(/\{\{triggeredBy\}\}/g, job.triggeredBy)
      .replace(/\{\{instruction\}\}/g, job.instruction)
      .replace(/\{\{owner\}\}/g, job.owner)
      .replace(/\{\{repo\}\}/g, job.repo)
      .replace(/\{\{prNumber\}\}/g, String(job.prNumber))
      .replace(/\{\{branch\}\}/g, job.branch)
      .replace(/\{\{timestamp\}\}/g, String(Date.now()))
      .trim();
  }

  // Use JIRA template for JIRA-triggered jobs
  return jiraInstructionsTemplate
    .replace(/\{\{issueKey\}\}/g, job.issueKey)
    .replace(/\{\{triggeredBy\}\}/g, job.triggeredBy)
    .replace(/\{\{instruction\}\}/g, job.instruction)
    .replace(/\{\{timestamp\}\}/g, String(Date.now()))
    .trim();
}

/**
 * Invoke Claude Code CLI to process a job
 */
export async function invokeClaudeCode(
  job: Job,
  workDir: string
): Promise<{ success: boolean; output: string; error?: string }> {
  const prompt = buildPrompt(job);

  return new Promise((resolve) => {
    // Pass prompt as argument (prompt must come right after --print)
    // --dangerously-skip-permissions is required for non-interactive/automated usage
    // to allow MCP tools without interactive permission prompts
    const args = [
      "--print",
      prompt,
      "--mcp-config",
      mcpConfigPath,
      "--dangerously-skip-permissions",
    ];

    // Add model if specified via environment variable
    if (process.env.CLAUDE_MODEL) {
      args.push("--model", process.env.CLAUDE_MODEL);
    }

    console.log(`Invoking Claude Code CLI for ${job.issueKey}...`);

    const proc = spawn("claude", args, {
      cwd: workDir,
      env: {
        ...process.env,
        // MCP config will be loaded from mcp-config.json
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    proc.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        resolve({
          success: false,
          output: stdout,
          error: stderr || `Process exited with code ${code}`,
        });
      }
    });

    proc.on("error", (err) => {
      resolve({
        success: false,
        output: stdout,
        error: `Failed to spawn process: ${err.message}`,
      });
    });
  });
}

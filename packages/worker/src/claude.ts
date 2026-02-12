import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import type { Job } from "@mapthew/shared/types";
import { getClaudeModel } from "@mapthew/shared/config";
import { buildPrompt } from "./prompt.js";
import { getReadableId } from "./utils.js";

// ES module equivalent of __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// MCP config path
const mcpConfigPath = path.join(__dirname, "..", "mcp-config.json");

/**
 * Options for invoking Claude Code CLI
 */
export interface InvokeOptions {
  /** Whether to resume an existing session */
  hasSession?: boolean;
}

/**
 * Invoke Claude Code CLI to process a job
 *
 * @param job - The job to process
 * @param workDir - The working directory for Claude
 * @param options - Optional settings (e.g., session resume)
 * @param secretEnv - Env-var-mapped secrets (from SecretsManager.getEnv())
 */
export async function invokeClaudeCode(
  job: Job,
  workDir: string,
  options: InvokeOptions = {},
  secretEnv: Record<string, string> = {},
): Promise<{ success: boolean; output: string; error?: string }> {
  const { hasSession = false } = options;
  const prompt = buildPrompt(job);
  const model = await getClaudeModel();

  return new Promise((resolve) => {
    // Build args based on whether we're resuming a session
    const args: string[] = [];

    if (hasSession) {
      // Resume existing session with new prompt
      // --continue resumes the most recent conversation in this directory
      args.push("--continue", "--print", prompt);
      console.log(
        `[Session] Resuming existing session for ${getReadableId(job)}`,
      );
    } else {
      // Start new session
      args.push("--print", prompt);
      console.log(`[Session] Starting new session for ${getReadableId(job)}`);
    }

    // Common args
    args.push(
      "--mcp-config",
      mcpConfigPath,
      "--dangerously-skip-permissions",
      "--model",
      model,
    );

    console.log(
      `Invoking Claude Code CLI for ${getReadableId(job)} with model ${model}...`,
    );

    const proc = spawn("claude", args, {
      cwd: workDir,
      env: { ...process.env, ...secretEnv },
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

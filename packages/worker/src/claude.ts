import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import type { Job } from "@dexter/shared/types";
import { buildPrompt } from "./prompt.js";
import { getReadableId } from "./utils.js";

// ES module equivalent of __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// MCP config path
const mcpConfigPath = path.join(__dirname, "..", "mcp-config.json");

/**
 * Invoke Claude Code CLI to process a job
 */
export async function invokeClaudeCode(
  job: Job,
  workDir: string,
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

    console.log(`Invoking Claude Code CLI for ${getReadableId(job)}...`);

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

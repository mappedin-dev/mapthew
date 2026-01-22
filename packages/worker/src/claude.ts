import { spawn } from 'child_process';
import path from 'path';
import type { Job } from '@dexter/shared';

/**
 * Build the prompt for Claude Code CLI
 */
function buildPrompt(job: Job): string {
  return `
You have been triggered by a JIRA comment on ticket ${job.issueKey}.

Instruction from ${job.triggeredBy}:
${job.instruction}

Your task:
1. Use the JIRA MCP to fetch the full details of ticket ${job.issueKey}, including:
   - Summary and description
   - All comments
   - Any attachments or images
   - Linked issues

2. Use the GitHub MCP to search for the appropriate repository based on the ticket context.
   - Look at the project key, labels, components, and description
   - Find the most relevant repository

3. Clone the repository and create a new branch named: ${job.issueKey}/${Date.now()}

4. Implement the requested changes based on the ticket context and instruction.

5. Commit your changes with a message: [${job.issueKey}] <brief description>

6. Push the branch and create a pull request using the GitHub MCP.
   - Title: [${job.issueKey}] <brief description>
   - Body: Link to the JIRA ticket and summary of changes

7. Post the PR link as a comment on the JIRA ticket using the JIRA MCP.
   - Comment: "🤓 Done! <PR URL>"

Work carefully and methodically. If you encounter any issues, explain what went wrong.
`.trim();
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
    const args = [
      '--print',
      prompt,
      '--allowedTools',
      'mcp,bash,read,write',
    ];

    console.log(`Invoking Claude Code CLI for ${job.issueKey}...`);

    const proc = spawn('claude', args, {
      cwd: workDir,
      env: {
        ...process.env,
        // MCP config will be loaded from mcp-config.json
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    proc.on('close', (code) => {
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

    proc.on('error', (err) => {
      resolve({
        success: false,
        output: stdout,
        error: `Failed to spawn process: ${err.message}`,
      });
    });
  });
}

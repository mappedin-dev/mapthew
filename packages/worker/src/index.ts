import { createWorker, createQueue, type Job, type BullJob } from '@dexter/shared';
import { invokeClaudeCode } from './claude.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || '';
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || '';

/**
 * Post a comment to JIRA
 */
async function postJiraComment(issueKey: string, comment: string): Promise<void> {
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.warn('JIRA credentials not configured - skipping comment');
    return;
  }

  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

  const response = await fetch(
    `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/comment`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: comment }],
            },
          ],
        },
      }),
    }
  );

  if (!response.ok) {
    console.error('Failed to post JIRA comment:', await response.text());
  }
}

/**
 * Create a temporary workspace directory
 */
async function createTempWorkspace(issueKey: string): Promise<string> {
  const tempDir = path.join(os.tmpdir(), `dexter-${issueKey}-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Clean up a workspace directory
 */
async function cleanupWorkspace(workDir: string): Promise<void> {
  try {
    await fs.rm(workDir, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Failed to cleanup workspace ${workDir}:`, error);
  }
}

/**
 * Process a job
 */
async function processJob(bullJob: BullJob<Job>): Promise<void> {
  const job = bullJob.data;
  console.log(`Processing job for ${job.issueKey}: ${job.instruction}`);

  const workDir = await createTempWorkspace(job.issueKey);
  console.log(`Created workspace: ${workDir}`);

  try {
    const result = await invokeClaudeCode(job, workDir);

    if (!result.success) {
      throw new Error(result.error || 'Claude Code CLI failed');
    }

    console.log(`Job completed for ${job.issueKey}`);
  } finally {
    await cleanupWorkspace(workDir);
    console.log(`Cleaned up workspace: ${workDir}`);
  }
}

// Create worker
const worker = createWorker(REDIS_URL, processJob);

// Handle failed jobs - post error to JIRA
worker.on('failed', async (job, err) => {
  if (job) {
    console.error(`Job failed for ${job.data.issueKey}:`, err.message);
    await postJiraComment(
      job.data.issueKey,
      `🤓 Oops, I hit an error: ${err.message}`
    );
  }
});

// Handle completed jobs
worker.on('completed', (job) => {
  console.log(`Job completed: ${job.data.issueKey}`);
});

console.log('Worker started, waiting for jobs...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  process.exit(0);
});

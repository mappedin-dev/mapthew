import { isGitHubJob, isJiraJob, Job } from "@mapthew/shared";

/**
 * Get a job identifier for logging
 */
export function getReadableId(job: Job): string {
  if (isGitHubJob(job)) {
    return `${job.repo}#${job.prNumber}`;
  }

  if (isJiraJob(job)) {
    return job.issueKey;
  }

  return "";
}

/**
 * Get the issue key for workspace/session grouping.
 *
 * For Jira jobs: returns the issueKey (e.g., "DXTR-123")
 * For GitHub jobs: returns a composite key (e.g., "gh-owner-repo-42")
 *
 * This key is used to group related jobs together so they share
 * the same workspace and Claude session.
 */
export function getIssueKey(job: Job): string {
  if (isJiraJob(job)) {
    return job.issueKey;
  }

  if (isGitHubJob(job)) {
    // Use a composite key for GitHub jobs
    // Format: gh-{owner}-{repo}-{prNumber}
    return `gh-${job.owner}-${job.repo}-${job.prNumber}`;
  }

  return `unknown-${Date.now()}`;
}

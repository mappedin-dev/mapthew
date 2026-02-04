import {
  isAdminJob,
  isGitHubJob,
  isJiraJob,
  extractIssueKeyFromBranch,
  Job,
} from "@mapthew/shared";

/**
 * Get a job identifier for logging
 */
export function getReadableId(job: Job): string {
  if (isGitHubJob(job)) {
    const number = job.prNumber ?? job.issueNumber;
    return number ? `${job.repo}#${number}` : job.repo;
  }

  if (isJiraJob(job)) {
    return job.issueKey;
  }

  if (isAdminJob(job)) {
    return "admin";
  }

  return "";
}

/**
 * Get the issue key for workspace/session grouping.
 *
 * For Jira jobs: returns the issueKey (e.g., "DXTR-123")
 * For GitHub jobs: extracts issue key from branch name if available,
 *   otherwise returns a composite key (e.g., "gh-owner-repo-42")
 * For Admin jobs: uses jiraIssueKey if available, otherwise generates a unique key
 *
 * This key is used to group related jobs together so they share
 * the same workspace and Claude session.
 */
export function getIssueKey(job: Job): string {
  if (isJiraJob(job)) {
    return job.issueKey;
  }

  if (isGitHubJob(job)) {
    // Try to extract issue key from branch name (e.g., "feature/DXTR-123-add-auth")
    if (job.branchName) {
      const issueKey = extractIssueKeyFromBranch(job.branchName);
      if (issueKey) {
        return issueKey;
      }
    }

    // Fallback to composite key for PRs/issues without Jira issue in branch name
    const number = job.prNumber ?? job.issueNumber;
    return `gh-${job.owner}-${job.repo}-${number}`;
  }

  if (isAdminJob(job)) {
    // Use Jira issue key if provided
    if (job.jiraIssueKey) {
      return job.jiraIssueKey;
    }
    // Use GitHub context if provided
    if (job.githubOwner && job.githubRepo) {
      const number = job.githubPrNumber ?? job.githubIssueNumber;
      if (number) {
        return `gh-${job.githubOwner}-${job.githubRepo}-${number}`;
      }
    }
    // Generate a unique key for admin jobs without context
    return `admin-${Date.now()}`;
  }

  return `unknown-${Date.now()}`;
}

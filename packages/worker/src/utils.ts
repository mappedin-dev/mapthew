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

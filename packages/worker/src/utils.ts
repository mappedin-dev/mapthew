import { isAdminJob, isGitHubJob, isJiraJob, Job } from "@mapthew/shared";

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

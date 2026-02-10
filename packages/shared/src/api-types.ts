/**
 * Re-export API-specific types used by the dashboard.
 * These types are a subset of the full types used by the backend.
 */
export type {
  JobState,
  JobProgress,
  QueueStats,
  JobData,
  SecretsStatus,
  SearchResult,
  GitHubRepoResult,
  AdminJobContext,
} from "./types.js";

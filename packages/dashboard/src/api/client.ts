import type {
  QueueStats,
  JobData,
  SecretsStatus,
  SearchResult,
  GitHubRepoResult,
  AdminJobContext,
  AppConfig,
} from "@mapthew/shared/types";

const API_BASE = "/api";

// Token getter function, set by ApiTokenProvider
let getAccessToken: (() => Promise<string>) | null = null;

export function setTokenGetter(getter: () => Promise<string>) {
  getAccessToken = getter;
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  if (!getAccessToken) {
    throw new Error("API client not initialized - missing token getter");
  }

  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  // Queue endpoints
  getQueueStats: () => fetchJSON<QueueStats>("/queue"),

  getJobs: (status?: string, limit = 50) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("limit", String(limit));
    return fetchJSON<JobData[]>(`/queue/jobs?${params}`);
  },

  getJob: (id: string) => fetchJSON<JobData>(`/queue/jobs/${id}`),

  retryJob: (id: string) =>
    fetchJSON<{ success: boolean }>(`/queue/jobs/${id}/retry`, {
      method: "POST",
    }),

  removeJob: (id: string) =>
    fetchJSON<{ success: boolean }>(`/queue/jobs/${id}`, {
      method: "DELETE",
    }),

  createJob: (instruction: string, context?: AdminJobContext) =>
    fetchJSON<{ success: boolean; jobId: string }>("/queue/jobs", {
      method: "POST",
      body: JSON.stringify({ instruction, ...context }),
    }),

  // Search endpoints
  searchJiraBoards: (query: string) =>
    fetchJSON<SearchResult[]>(
      `/search/jira/boards?q=${encodeURIComponent(query)}`
    ),

  searchJiraIssues: (query: string, boardId: string) =>
    fetchJSON<SearchResult[]>(
      `/search/jira/issues?q=${encodeURIComponent(
        query
      )}&board=${encodeURIComponent(boardId)}`
    ),

  searchGitHubRepos: (query: string) =>
    fetchJSON<GitHubRepoResult[]>(
      `/search/github/repos?q=${encodeURIComponent(query)}`
    ),

  searchGitHubBranches: (owner: string, repo: string, query: string) =>
    fetchJSON<SearchResult[]>(
      `/search/github/branches?owner=${encodeURIComponent(
        owner
      )}&repo=${encodeURIComponent(repo)}&q=${encodeURIComponent(query)}`
    ),

  searchGitHubPulls: (owner: string, repo: string, query: string) =>
    fetchJSON<SearchResult[]>(
      `/search/github/pulls?owner=${encodeURIComponent(
        owner
      )}&repo=${encodeURIComponent(repo)}&q=${encodeURIComponent(query)}`
    ),

  searchGitHubIssues: (owner: string, repo: string, query: string) =>
    fetchJSON<SearchResult[]>(
      `/search/github/issues?owner=${encodeURIComponent(
        owner
      )}&repo=${encodeURIComponent(repo)}&q=${encodeURIComponent(query)}`
    ),

  // Config endpoints
  getConfig: () => fetchJSON<AppConfig>("/config"),

  updateConfig: (config: Partial<AppConfig>) =>
    fetchJSON<AppConfig>("/config", {
      method: "PUT",
      body: JSON.stringify(config),
    }),

  // Secrets endpoint (read-only)
  getSecrets: () => fetchJSON<SecretsStatus>("/secrets"),
};

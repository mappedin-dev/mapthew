const API_BASE = "/api";

export interface QueueStats {
  name: string;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
}

export interface JobData {
  id: string;
  name: string;
  data: Record<string, unknown>;
  status: "waiting" | "active" | "completed" | "failed" | "delayed";
  progress: number;
  attemptsMade: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  returnvalue?: unknown;
}

export interface Config {
  botName: string;
  botDisplayName: string;
  claudeModel: string;
  availableModels: string[];
  jiraBaseUrl: string;
}

// Search result types
export interface SearchResult {
  id: string;
  label: string;
}

export interface GitHubRepoResult {
  owner: string;
  repo: string;
  label: string;
}

// Job context for creating admin jobs
export interface JobContext {
  jiraBoardId?: string;
  jiraIssueKey?: string;
  githubOwner?: string;
  githubRepo?: string;
  githubBranchId?: string;
  githubPrNumber?: number;
  githubIssueNumber?: number;
}

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

  createJob: (instruction: string, context?: JobContext) =>
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
  getConfig: () => fetchJSON<Config>("/config"),

  updateConfig: (config: Partial<Config>) =>
    fetchJSON<Config>("/config", {
      method: "PUT",
      body: JSON.stringify(config),
    }),
};

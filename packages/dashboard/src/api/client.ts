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
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
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

  // Config endpoints
  getConfig: () => fetchJSON<Config>("/config"),

  updateConfig: (config: Partial<Config>) =>
    fetchJSON<Config>("/config", {
      method: "PUT",
      body: JSON.stringify(config),
    }),
};
